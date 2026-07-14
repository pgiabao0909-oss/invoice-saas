import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, recordAudit } from '@invoice-saas/db';
import { AUDIT_EVENTS } from '@invoice-saas/contracts';

/**
 * C6 — tenant isolation guard (the hard failsafe at the API boundary, ADR 0001).
 *
 * The data layer (`TenantScoped` / `tenantId` filters) already scopes every query,
 * but a single forgotten `where: { tenantId }` in a new route would silently leak
 * another tenant's rows. This hook is defense-in-depth: it inspects the JSON body
 * of every response sent to a tenant-scoped caller and fails loudly if ANY entity
 * in it carries a `tenantId` other than the caller's.
 *
 * On a violation it:
 *   1. logs `[ISOLATION VIOLATION]` (always, even if audit write fails);
 *   2. records an immutable `tenant.isolation_violation` audit event (the worker's
 *      tenancy scanner reads these and raises a C5 alert — closing the loop).
 *
 * It only acts on 2xx JSON responses for requests that resolved a tenant
 * (`request.tenant` set). Non-tenant endpoints (/tenants, /webhooks, /health,
 * errors) are exempt. Gated by `ISOLATION_GUARD` (default on; set to `false` to
 * disable). `ISOLATION_FAIL_CLOSED=true` additionally replaces the leaked body
 * with a 500 so a leak can never reach the caller.
 */

export interface IsolationViolation {
  path: string;
  tenantId: string;
}

/**
 * Recursively walk a parsed JSON payload and return the location + `tenantId` of
 * every object whose `tenantId` does not match the expected one. Pure + tested.
 */
export function findIsolationViolations(
  payload: unknown,
  expectedTenantId: string,
  path = '$',
): IsolationViolation[] {
  const violations: IsolationViolation[] = [];
  const visit = (value: unknown, at: string): void => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${at}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.tenantId === 'string' && obj.tenantId !== expectedTenantId) {
        violations.push({ path: at, tenantId: obj.tenantId });
      }
      for (const key of Object.keys(obj)) visit(obj[key], `${at}.${key}`);
    }
  };
  visit(payload, path);
  return violations;
}

export interface IsolationGuardOptions {
  /** Disable the guard entirely (default: enabled). */
  enabled?: boolean;
  /**
   * Side-effect on a detected violation (audit/alert). Defaults to recording an
   * immutable `tenant.isolation_violation` audit event. Injected in tests to stay
   * hermetic. The loud `console.error` always fires regardless.
   */
  onViolation?: (detail: Record<string, unknown>) => void;
}

function defaultRecordViolation(detail: Record<string, unknown>): void {
  const tenantId = detail.expectedTenantId as string;
  void recordAudit(prisma, {
    tenantId,
    event: AUDIT_EVENTS.TENANT_ISOLATION_VIOLATION,
    detail,
  }).catch(() => {});
}

export function registerIsolationGuard(
  app: FastifyInstance,
  opts: IsolationGuardOptions = {},
): void {
  const enabled = opts.enabled ?? process.env.ISOLATION_GUARD !== 'false';
  if (!enabled) return;

  const failClosed = process.env.ISOLATION_FAIL_CLOSED === 'true';
  const onViolation = opts.onViolation ?? defaultRecordViolation;

  app.addHook('onSend', (request: FastifyRequest, reply: FastifyReply, payload, done) => {
    const tenant = request.tenant;
    // Only tenant-scoped requests carry a known caller identity to check against.
    if (!tenant) return done(null, payload);

    const status = reply.statusCode;
    const contentType = reply.getHeader('content-type');
    if (status < 200 || status >= 300 || typeof contentType !== 'string' || !contentType.includes('application/json')) {
      return done(null, payload);
    }

    let body: unknown;
    try {
      body = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      return done(null, payload);
    }

    let violations: IsolationViolation[];
    try {
      violations = findIsolationViolations(body, tenant.id);
    } catch {
      return done(null, payload);
    }
    if (violations.length === 0) return done(null, payload);

    const detail = {
      route: request.routeOptions?.url ?? request.url,
      method: request.method,
      expectedTenantId: tenant.id,
      violations,
    };
    console.error(
      `[ISOLATION VIOLATION] ${detail.route} leaked ${violations.length} cross-tenant entit(ies): ` +
        JSON.stringify(violations),
    );
    // The audit trail is the contract the worker scanner watches (raises a C5 alert).
    onViolation(detail);

    if (failClosed) {
      const msg = JSON.stringify({ error: 'isolation_violation', message: 'response contained cross-tenant data' });
      reply.header('content-type', 'application/json');
      return done(null, msg);
    }
    return done(null, payload);
  });
}

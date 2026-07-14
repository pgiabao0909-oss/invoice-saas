import type { PrismaClient } from '@prisma/client';
import { AUDIT_EVENTS } from '@invoice-saas/contracts';
import type { IsolationStatus, IsolationViolationEvent } from '@invoice-saas/contracts';

/**
 * C6 — read-only tenant-isolation health probe (the observable half of the isolation
 * guard). It mirrors the two checks the worker's scheduled tenancy scanner performs,
 * but returns them as data instead of raising alerts — so an admin UI can render the
 * current posture at any time.
 *
 *   1. API-boundary violations: recent `tenant.isolation_violation` audit events (a
 *      route leaked cross-tenant data; emitted by `registerIsolationGuard`).
 *   2. Data-integrity: any row in a tenant-scoped table whose `tenantId` is not a real
 *      tenant (orphaned / injected / mis-tenant'd).
 *
 * The `lookbackMs` matches the worker's `TENANCY_SCAN_LOOKBACK_MS` (10 min) so the UI
 * agrees with what the scanner would alert on. Neither query mutates data.
 */
const TENANT_SCOPED_TABLES = ['invoice', 'client', 'subscription', 'payment', 'taxRate'] as const;

export interface GetIsolationStatusOpts {
  /** How far back to look for boundary violations (default 10 min). */
  lookbackMs?: number;
  /** Max boundary violations to return (default 50). */
  violationLimit?: number;
}

export async function getIsolationStatus(
  prisma: PrismaClient,
  opts: GetIsolationStatusOpts = {},
): Promise<IsolationStatus> {
  const lookbackMs = opts.lookbackMs ?? 10 * 60 * 1000;
  const violationLimit = opts.violationLimit ?? 50;

  const since = new Date(Date.now() - lookbackMs);
  const [violationRows, tenantRows] = await Promise.all([
    prisma.auditLog.findMany({
      where: { event: AUDIT_EVENTS.TENANT_ISOLATION_VIOLATION, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: violationLimit,
      select: { id: true, tenantId: true, detail: true, createdAt: true },
    }),
    prisma.tenant.findMany({ select: { id: true } }),
  ]);

  const tenantIds = tenantRows.map((t) => t.id);
  const foreignRows: Record<string, number> = {};
  for (const table of TENANT_SCOPED_TABLES) {
    const rows = await (prisma as unknown as Record<string, any>)[table].findMany({
      where: { tenantId: { notIn: tenantIds } },
      select: { id: true },
    });
    if (rows.length > 0) foreignRows[table] = rows.length;
  }

  const violations: IsolationViolationEvent[] = violationRows.map((v) => ({
    id: v.id,
    tenantId: v.tenantId,
    detail: v.detail,
    createdAt: v.createdAt.toISOString(),
  }));

  const healthy = violations.length === 0 && Object.keys(foreignRows).length === 0;

  return {
    healthy,
    tenants: tenantIds.length,
    violations,
    foreignRows,
    checkedAt: new Date().toISOString(),
  };
}

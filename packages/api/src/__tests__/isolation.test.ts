import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { findIsolationViolations, registerIsolationGuard } from '../plugins/isolation.js';

/**
 * C6 — the API-boundary tenant isolation guard. The pure walker is unit-tested, and
 * an end-to-end inject proves the onSend hook catches a response that leaks another
 * tenant's entity (and leaves legitimate same-tenant responses untouched).
 */
describe('findIsolationViolations — pure walker', () => {
  it('passes a same-tenant object', () => {
    expect(findIsolationViolations({ tenantId: 't1', name: 'x' }, 't1')).toEqual([]);
  });

  it('flags a single cross-tenant entity', () => {
    const v = findIsolationViolations({ tenantId: 't2', name: 'x' }, 't1');
    expect(v).toHaveLength(1);
    expect(v[0]!.tenantId).toBe('t2');
  });

  it('flags nested + array entities but ignores non-tenant objects', () => {
    const payload = {
      tenantId: 't1',
      items: [
        { tenantId: 't1', sku: 'a' },
        { tenantId: 't9', sku: 'b' }, // leak inside an array
      ],
      nested: { tenantId: 't1', child: { tenantId: 't7' } }, // leak nested
      branding: { primaryColor: '#fff' }, // no tenantId — ignored
    };
    const v = findIsolationViolations(payload, 't1');
    expect(v.map((x) => x.tenantId).sort()).toEqual(['t7', 't9']);
  });

  it('treats a missing tenantId as not-a-violation (only mismatches count)', () => {
    expect(findIsolationViolations({ name: 'no tenant', lineItems: [] }, 't1')).toEqual([]);
  });
});

describe('registerIsolationGuard — onSend hook', () => {
  function buildApp(onViolation: (d: Record<string, unknown>) => void) {
    const app = Fastify();
    registerIsolationGuard(app, { onViolation });
    // Simulate resolveTenant ONLY on tenant-scoped routes (real non-tenant routes
    // like /tenants, /webhooks, /health never set request.tenant, so the guard skips).
    const asTenant = (req: any, _reply: unknown, done: () => void) => {
      req.tenant = { id: 't1', dataMode: 'POOLED', dataLocation: null, baseCurrency: 'USD' };
      done();
    };
    app.get('/ok', { preHandler: asTenant }, (_req, reply) => reply.send({ tenantId: 't1', name: 'self' }));
    app.get('/list-ok', { preHandler: asTenant }, (_req, reply) =>
      reply.send([{ tenantId: 't1', a: 1 }, { tenantId: 't1', b: 2 }]),
    );
    app.get('/leak', { preHandler: asTenant }, (_req, reply) => reply.send({ tenantId: 't2', name: 'other' }));
    app.get('/list-leak', { preHandler: asTenant }, (_req, reply) =>
      reply.send([{ tenantId: 't1', a: 1 }, { tenantId: 't3', b: 2 }]),
    );
    // Non-tenant endpoint (no resolveTenant) — guard must not run / false-positive.
    app.get('/public', (_req, reply) => reply.send([{ tenantId: 't1' }, { tenantId: 't2' }]));
    return app;
  }

  it('allows same-tenant responses and records no violation', async () => {
    const onViolation = vi.fn();
    const app = buildApp(onViolation);
    const r1 = await app.inject({ method: 'GET', url: '/ok' });
    const r2 = await app.inject({ method: 'GET', url: '/list-ok' });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(onViolation).not.toHaveBeenCalled();
  });

  it('detects a single leaked entity and flags the violation', async () => {
    const onViolation = vi.fn();
    const app = buildApp(onViolation);
    const res = await app.inject({ method: 'GET', url: '/leak' });
    expect(res.statusCode).toBe(200); // open mode: still returns the body
    expect(onViolation).toHaveBeenCalledTimes(1);
    const detail = onViolation.mock.calls[0]![0];
    expect(detail.expectedTenantId).toBe('t1');
    expect((detail.violations as Array<{ tenantId: string }>)[0]!.tenantId).toBe('t2');
  });

  it('detects a leaked entity inside a list response', async () => {
    const onViolation = vi.fn();
    const app = buildApp(onViolation);
    await app.inject({ method: 'GET', url: '/list-leak' });
    expect(onViolation).toHaveBeenCalledTimes(1);
    const detail = onViolation.mock.calls[0]![0];
    expect((detail.violations as Array<{ tenantId: string }>).map((v) => v.tenantId)).toEqual(['t3']);
  });

  it('does NOT flag non-tenant (public) responses', async () => {
    const onViolation = vi.fn();
    const app = buildApp(onViolation);
    const res = await app.inject({ method: 'GET', url: '/public' });
    expect(res.statusCode).toBe(200);
    expect(onViolation).not.toHaveBeenCalled();
  });
});

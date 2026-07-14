import Fastify from 'fastify';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod';
import { adminRoutes } from '../routes/admin.js';

/**
 * C6 — exercises `GET /admin/isolation-status` end-to-end with `fastify.inject`, using
 * a fake Prisma (no DB). The fake carries two real tenants and one foreign (non-tenant)
 * invoice row, plus one recent boundary-violation audit event — so the endpoint should
 * report `healthy: false`, one violation, and one foreign row.
 */

const ADMIN_TOKEN = 'test-admin-secret';

beforeEach(() => {
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
});
afterEach(() => {
  delete process.env.ADMIN_API_TOKEN;
});

function makeFakePrisma() {
  const tenants = [{ id: 't1' }, { id: 't2' }];

  const auditLog = {
    findMany: async (args: {
      where: { event: string; createdAt: { gte: Date } };
      orderBy: { createdAt: 'desc' };
      take: number;
      select: { id: boolean; tenantId: boolean; detail: boolean; createdAt: boolean };
    }) => {
      if (args.where.event !== 'tenant.isolation_violation') return [];
      return [
        {
          id: 'c000000000av1',
          tenantId: 'c000000000t01',
          detail: {
            route: '/invoices',
            method: 'GET',
            expectedTenantId: 't1',
            violations: [{ path: '$[0]', tenantId: 't9' }],
          },
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ];
    },
  };

  const makeTable = (rows: Array<{ id: string; tenantId: string }>) => ({
    findMany: async (args: {
      where?: { tenantId?: { notIn: string[] } };
      select?: { id: boolean };
    }) => {
      if (args.where?.tenantId?.notIn) {
        const known = args.where.tenantId.notIn;
        return rows.filter((r) => !known.includes(r.tenantId));
      }
      return rows;
    },
  });

  const prisma: any = {
    tenant: { findMany: async () => tenants },
    auditLog,
    invoice: makeTable([{ id: 'i1', tenantId: 't1' }, { id: 'i2', tenantId: 'ghost' }]),
    client: makeTable([]),
    subscription: makeTable([]),
    payment: makeTable([]),
    taxRate: makeTable([]),
  };
  return { prisma };
}

const servers: Fastify.FastifyInstance[] = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
});

function buildApp(prisma: unknown): Fastify.FastifyInstance {
  const app = Fastify();
  servers.push(app);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.withTypeProvider<ZodTypeProvider>();
  app.register(adminRoutes({ prisma: prisma as any }), { prefix: '/admin' });
  return app;
}

describe('GET /admin/isolation-status', () => {
  it('returns the scan summary when authorized', async () => {
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/isolation-status',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.healthy).toBe(false);
    expect(body.tenants).toBe(2);
    expect(body.violations).toHaveLength(1);
    expect(body.violations[0].detail.route).toBe('/invoices');
    expect(body.foreignRows).toEqual({ invoice: 1 });
  });

  it('rejects a request with no Authorization header (401)', async () => {
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({ method: 'GET', url: '/admin/isolation-status' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with a wrong token (401)', async () => {
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/isolation-status',
      headers: { authorization: 'Bearer not-the-right-token' },
    });
    expect(res.statusCode).toBe(401);
  });
});

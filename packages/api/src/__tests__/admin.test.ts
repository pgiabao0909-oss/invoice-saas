import Fastify from 'fastify';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod';
import { adminRoutes } from '../routes/admin.js';

/**
 * T4 — exercises the manual overdue-sweep trigger (POST /admin/run-overdue) end-to-end
 * with `fastify.inject`, using a fake Prisma (no DB). The fake carries one tenant with
 * one sent, past-due, unpaid invoice, so a single sweep should flip 1 and enqueue 3.
 */

const ADMIN_TOKEN = 'test-admin-secret';

beforeEach(() => {
  process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
});
afterEach(() => {
  delete process.env.ADMIN_API_TOKEN;
});
function makeFakePrisma() {
  const tenants = [{ id: 't1' }];
  const invoices = new Map<string, any>();
  const jobs: Array<{ type: string; payload: Record<string, unknown> }> = [];

  invoices.set('inv1', {
    id: 'inv1',
    tenantId: 't1',
    clientId: 'c1',
    invoiceNumber: 'INV-1',
    status: 'sent',
    currency: 'USD',
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2020-01-01T00:00:00Z'), // long past due
    lineItems: [],
    discount: null,
    subtotalMinor: 1000,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor: 1000,
    amountPaidMinor: 0,
    paymentLink: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

  const invoiceModels = () => ({
    findMany: async (args: {
      where?: { tenantId?: string; status?: string; dueDate?: { lt: Date } };
    }) => {
      let rows = [...invoices.values()];
      if (args?.where?.tenantId) rows = rows.filter((r) => r.tenantId === args.where!.tenantId);
      if (args?.where?.status) rows = rows.filter((r) => r.status === args.where!.status);
      if (args?.where?.dueDate?.lt) {
        const asOf = args.where!.dueDate!.lt.getTime();
        rows = rows.filter((r) => r.dueDate.getTime() < asOf);
      }
      return rows;
    },
    findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
      const row = invoices.get(args.where.id);
      if (!row) return null;
      if (args.where.tenantId && row.tenantId !== args.where.tenantId) return null;
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = invoices.get(args.where.id);
      if (!row) throw new Error('INVOICE_NOT_FOUND');
      Object.assign(row, args.data);
      return row;
    },
  });

  const prisma: any = {
    $transaction: async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        invoice: invoiceModels(),
        job: { create: async (a: { data: { type: string; payload: Record<string, unknown> } }) => {
          jobs.push(a.data);
          return {};
        } },
      }),
    invoice: invoiceModels(),
    job: { create: async (a: { data: { type: string; payload: Record<string, unknown> } }) => {
      jobs.push(a.data);
      return {};
    } },
    tenant: { findMany: async () => tenants },
  };
  return { prisma, invoices, jobs };
}

const servers: Fastify.FastifyInstance[] = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
});

function buildApp(prisma: unknown): Fastify.FastifyInstance {
  const app = Fastify();
  servers.push(app);
  // Mirror server.ts: the Zod type provider must be installed for response schemas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.withTypeProvider<ZodTypeProvider>();
  app.register(adminRoutes({ prisma: prisma as any }), { prefix: '/admin' });
  return app;
}

describe('POST /admin/run-overdue', () => {
  it('flips past-due invoices and returns the flipped/reminder counts when authorized', async () => {
    const { prisma, invoices, jobs } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({
      method: 'POST',
      url: '/admin/run-overdue',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.flipped).toBe(1);
    expect(body.remindersEnqueued).toBe(3);
    expect(invoices.get('inv1').status).toBe('overdue');
    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.type === 'INVOICE_REMINDER')).toBe(true);
  });

  it('rejects a request with no Authorization header (401)', async () => {
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({ method: 'POST', url: '/admin/run-overdue' });

    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with a wrong token (401)', async () => {
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({
      method: 'POST',
      url: '/admin/run-overdue',
      headers: { authorization: 'Bearer not-the-right-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects every request when ADMIN_API_TOKEN is not configured (401)', async () => {
    delete process.env.ADMIN_API_TOKEN;
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma);

    const res = await app.inject({
      method: 'POST',
      url: '/admin/run-overdue',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(res.statusCode).toBe(401);
  });
});

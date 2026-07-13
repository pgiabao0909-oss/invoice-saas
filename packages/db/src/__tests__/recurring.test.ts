import { describe, it, expect } from 'vitest';
import {
  advanceDate,
  createSubscription,
  listSubscriptions,
  runDueSubscriptions,
} from '../domain/recurring.js';
import type { SubscriptionCreate, TenantId } from '@invoice-saas/contracts';

/**
 * Exercises the C2 recurring-billing domain against an in-memory Prisma (no DB):
 *  - a due subscription is billed (invoice auto-sent) and its anchor advances;
 *  - a not-yet-due subscription is left alone;
 *  - advanceDate does correct calendar math for each interval unit.
 */
const DAY = 24 * 60 * 60 * 1000;

function makeFakePrisma() {
  const store = {
    tenants: new Map<string, any>(),
    clients: new Map<string, any>(),
    invoices: new Map<string, any>(),
    subscriptions: new Map<string, any>(),
    audit: [] as Array<{ tenantId: string; invoiceId: string | null; event: string; detail: any }>,
    jobs: [] as Array<{ type: string; payload: any }>,
    outbox: [] as Array<any>,
    taxRates: [] as Array<any>,
    payment: [] as Array<any>,
  };
  let seq = 0;

  const models = () => ({
    tenant: { findMany: async () => [...store.tenants.values()] },
    client: {
      findFirst: async (args: { where: { id?: string; tenantId: string; email?: string } }) => {
        if (args.where.id) return store.clients.get(args.where.id) ?? null;
        return (
          [...store.clients.values()].find(
            (c) => c.tenantId === args.where.tenantId && (!args.where.email || c.email === args.where.email),
          ) ?? null
        );
      },
      findUnique: async (args: { where: { id: string } }) => store.clients.get(args.where.id) ?? null,
    },
    invoice: {
      findMany: async () => [...store.invoices.values()],
      findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
        const r = store.invoices.get(args.where.id);
        if (!r) return null;
        if (args.where.tenantId && r.tenantId !== args.where.tenantId) return null;
        return r;
      },
      create: async (a: { data: any }) => {
        const r = {
          id: `inv${++seq}`,
          status: 'draft',
          issueDate: new Date('2026-01-01T00:00:00Z'),
          amountPaidMinor: 0,
          paymentLink: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          ...a.data,
        };
        store.invoices.set(r.id, r);
        return r;
      },
      update: async (a: { where: { id: string }; data: any }) => {
        const r = store.invoices.get(a.where.id);
        if (!r) throw new Error('INVOICE_NOT_FOUND');
        Object.assign(r, a.data);
        return r;
      },
    },
    subscription: {
      findMany: async (args?: { where?: any; orderBy?: any }) => {
        let rows = [...store.subscriptions.values()];
        if (args?.where?.tenantId) rows = rows.filter((s) => s.tenantId === args.where.tenantId);
        if (args?.where?.active !== undefined) rows = rows.filter((s) => s.active === args.where.active);
        if (args?.where?.anchorDate?.lte)
          rows = rows.filter((s) => new Date(s.anchorDate) <= args.where.anchorDate.lte);
        if (args?.orderBy?.anchorDate === 'asc')
          rows = rows.sort((a, b) => new Date(a.anchorDate).getTime() - new Date(b.anchorDate).getTime());
        return rows;
      },
      create: async (a: { data: any }) => {
        const r = { id: `sub${++seq}`, createdAt: new Date('2026-01-01T00:00:00Z'), ...a.data };
        store.subscriptions.set(r.id, r);
        return r;
      },
      update: async (a: { where: { id: string }; data: any }) => {
        const r = store.subscriptions.get(a.where.id);
        if (!r) throw new Error('NOT_FOUND');
        Object.assign(r, a.data);
        return r;
      },
    },
    taxRate: { findMany: async () => store.taxRates },
    outboxMessage: { create: async (a: { data: any }) => { store.outbox.push(a.data); return {}; } },
    job: { create: async (a: { data: any }) => { store.jobs.push(a.data); return {}; } },
    auditLog: {
      create: async (a: { data: any }) => {
        store.audit.push({ tenantId: a.data.tenantId, invoiceId: a.data.invoiceId ?? null, event: a.data.event, detail: a.data.detail });
        return {};
      },
    },
    payment: {
      findFirst: async () => null,
      create: async (a: { data: any }) => { store.payment.push(a.data); return {}; },
    },
  });

  const prisma: any = {
    ...models(),
    $transaction: async (fn: (tx: ReturnType<typeof models>) => Promise<any>) => fn(models()),
  };
  return { prisma, store };
}

const baseSub: SubscriptionCreate = {
  clientId: 'c1',
  currency: 'USD',
  lineItems: [{ description: 'Monthly retainer', quantity: 1, unitPriceMinor: 10000 }],
  intervalUnit: 'month',
  intervalCount: 1,
};

describe('advanceDate', () => {
  it('advances each interval unit correctly', () => {
    const base = new Date('2026-01-31T00:00:00Z');
    expect(advanceDate(base, 'day', 1).getUTCDate()).toBe(1); // Feb 1 (rollover)
    expect(advanceDate(base, 'week', 2).getUTCDate()).toBe(14);
    expect(advanceDate(base, 'month', 1).getUTCMonth()).toBe(2); // Mar (Jan 31 + 1mo rolls to Mar 3)
    expect(advanceDate(base, 'year', 1).getUTCFullYear()).toBe(2027);
  });
});

describe('runDueSubscriptions — C2 hands-off generation', () => {
  it('generates an invoice for a due subscription and advances its anchor', async () => {
    const { prisma, store } = makeFakePrisma();
    const client = { id: 'c1', tenantId: 't1', email: 'a@b.test', legalName: 'A' };
    store.clients.set('c1', client);

    const sub = await createSubscription(prisma, 't1' as TenantId, {
      ...baseSub,
      anchorDate: new Date(Date.now() - DAY).toISOString(), // already due
    });

    const r = await runDueSubscriptions(prisma);
    expect(r.generated).toBe(1);
    expect(store.invoices.size).toBe(1);
    const inv = [...store.invoices.values()][0];
    expect(inv.status).toBe('sent'); // auto-sent via markSent, no human
    expect(store.jobs.some((j) => j.type === 'EMAIL_INVOICE')).toBe(true);
    // markSent ran the verification gate + outbox through a real transaction.
    expect(store.audit.some((a) => a.event === 'invoice.verified')).toBe(true);
    expect(store.audit.some((a) => a.event === 'invoice.sent')).toBe(true);
    expect(store.outbox.some((o) => o.type === 'INVOICE_SENT')).toBe(true);

    // Anchor advanced ~1 month into the future, so a re-run bills nothing.
    const updated = store.subscriptions.get(sub.id)!;
    expect(new Date(updated.anchorDate).getTime()).toBeGreaterThan(Date.now());
    const r2 = await runDueSubscriptions(prisma);
    expect(r2.generated).toBe(0);
    expect(store.invoices.size).toBe(1); // no duplicate
  });

  it('does not bill a subscription whose anchorDate is in the future', async () => {
    const { prisma, store } = makeFakePrisma();
    store.clients.set('c1', { id: 'c1', tenantId: 't1', email: 'a@b.test', legalName: 'A' });
    await createSubscription(prisma, 't1' as TenantId, {
      ...baseSub,
      anchorDate: new Date(Date.now() + 30 * DAY).toISOString(),
    });

    const r = await runDueSubscriptions(prisma);
    expect(r.generated).toBe(0);
    expect(store.invoices.size).toBe(0);
  });

  it('lists subscriptions for a tenant in anchor order', async () => {
    const { prisma, store } = makeFakePrisma();
    store.clients.set('c1', { id: 'c1', tenantId: 't1', email: 'a@b.test', legalName: 'A' });
    await createSubscription(prisma, 't1' as TenantId, { ...baseSub, anchorDate: new Date(Date.now() + 10 * DAY).toISOString() });
    await createSubscription(prisma, 't1' as TenantId, { ...baseSub, anchorDate: new Date(Date.now() + 5 * DAY).toISOString() });
    const list = await listSubscriptions(prisma, 't1' as TenantId);
    expect(list).toHaveLength(2);
    expect(new Date(list[0]!.anchorDate).getTime()).toBeLessThan(new Date(list[1]!.anchorDate).getTime());
  });

  it('rejects a subscription for a client that does not belong to the tenant', async () => {
    const { prisma } = makeFakePrisma();
    await expect(
      createSubscription(prisma, 't1' as TenantId, { ...baseSub, clientId: 'ghost' }),
    ).rejects.toThrow(/CLIENT_NOT_FOUND/);
  });
});

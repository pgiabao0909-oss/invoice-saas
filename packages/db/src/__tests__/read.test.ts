import { describe, it, expect } from 'vitest';
import {
  listInvoices,
  getInvoiceWithClient,
  listClients,
  createClient,
  listTenants,
  createTenant,
  getTenant,
  updateBranding,
  getStats,
} from '../domain/read.js';

/**
 * In-memory fake Prisma covering the subset of methods the read helpers use, so the
 * read layer is unit-tested without a database (mirrors mark-sent.test.ts).
 */
function makeFake() {
  const clients = [
    {
      id: 'c1',
      tenantId: 't1',
      legalName: 'Acme Co',
      email: 'billing@acme.test',
      billingAddress: '1 Acme Way',
      taxIdentifier: 'VAT-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];
  const invoices = [
    {
      id: 'inv1',
      tenantId: 't1',
      clientId: 'c1',
      invoiceNumber: 'INV-1',
      status: 'sent' as const,
      currency: 'USD',
      issueDate: new Date('2026-01-01T00:00:00Z'),
      dueDate: new Date('2026-01-15T00:00:00Z'),
      lineItems: [{ description: 'Widget', quantity: 1, unitPriceMinor: 1000 }],
      discount: null,
      subtotalMinor: 1000,
      taxMinor: 0,
      discountMinor: 0,
      totalMinor: 1000,
      amountPaidMinor: 0,
      paymentLink: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'inv2',
      tenantId: 't1',
      clientId: 'c1',
      invoiceNumber: 'INV-2',
      status: 'overdue' as const,
      currency: 'USD',
      issueDate: new Date('2026-01-02T00:00:00Z'),
      dueDate: new Date('2026-01-10T00:00:00Z'),
      lineItems: [{ description: 'Service', quantity: 2, unitPriceMinor: 5000 }],
      discount: null,
      subtotalMinor: 10000,
      taxMinor: 0,
      discountMinor: 0,
      totalMinor: 10000,
      amountPaidMinor: 4000,
      paymentLink: 'https://pay.test/inv2',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    },
    {
      id: 'inv3',
      tenantId: 't1',
      clientId: 'c1',
      invoiceNumber: 'INV-3',
      status: 'paid' as const,
      currency: 'USD',
      issueDate: new Date('2026-01-03T00:00:00Z'),
      dueDate: new Date('2026-01-20T00:00:00Z'),
      lineItems: [{ description: 'Sub', quantity: 1, unitPriceMinor: 2000 }],
      discount: null,
      subtotalMinor: 2000,
      taxMinor: 0,
      discountMinor: 0,
      totalMinor: 2000,
      amountPaidMinor: 2000,
      paymentLink: null,
      createdAt: new Date('2026-01-03T00:00:00Z'),
    },
  ];
  const tenants = [
    {
      id: 't1',
      name: 'Demo Workspace',
      slug: 'demo',
      dataMode: 'POOLED' as const,
      dataLocation: null,
      baseCurrency: 'USD',
      branding: { displayName: 'Demo', primaryColor: '#4F46E5' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  const prisma: any = {
    invoice: {
      findMany: async ({ where = {}, orderBy = {} }: any = {}) => {
        const filtered = invoices.filter((i) => {
          if (where.tenantId && i.tenantId !== where.tenantId) return false;
          if (where.status && i.status !== where.status) return false;
          if (where.clientId && i.clientId !== where.clientId) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          return [...filtered].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        }
        return filtered;
      },
      findFirst: async ({ where = {}, include }: any = {}) => {
        const found = invoices.find((i) => {
          if (where.id && i.id !== where.id) return false;
          if (where.tenantId && i.tenantId !== where.tenantId) return false;
          return true;
        });
        if (!found) return null;
        return include?.client
          ? { ...found, client: clients.find((c) => c.id === found.clientId) }
          : found;
      },
    },
    client: {
      findMany: async ({ where = {} }: any = {}) =>
        clients.filter((c) => !where.tenantId || c.tenantId === where.tenantId),
      create: async ({ data }: any) => {
        const exists = clients.find(
          (c) => c.tenantId === data.tenantId && c.email === data.email,
        );
        if (exists) {
          const e: any = new Error('Unique constraint failed');
          e.code = 'P2002';
          throw e;
        }
        const created = {
          ...data,
          id: 'c-new',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        };
        clients.push(created);
        return created;
      },
    },
    tenant: {
      findMany: async () => tenants,
      findUnique: async ({ where }: any) => tenants.find((t) => t.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const created = {
          ...data,
          id: 't-new',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        };
        tenants.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const t = tenants.find((x) => x.id === where.id)!;
        Object.assign(t, data);
        return t;
      },
    },
  };

  return { prisma, invoices, clients, tenants };
}

describe('db read helpers', () => {
  it('listInvoices maps rows and filters by status', async () => {
    const { prisma } = makeFake();
    const all = await listInvoices(prisma, 't1');
    expect(all).toHaveLength(3);
    expect(all[0]!.id).toBe('inv3'); // newest first

    const overdue = await listInvoices(prisma, 't1', { status: 'overdue' });
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.invoiceNumber).toBe('INV-2');
  });

  it('getInvoiceWithClient embeds the client', async () => {
    const { prisma } = makeFake();
    const inv = await getInvoiceWithClient(prisma, 't1', 'inv1');
    expect(inv).not.toBeNull();
    expect(inv!.client.legalName).toBe('Acme Co');
    expect(await getInvoiceWithClient(prisma, 't1', 'nope')).toBeNull();
  });

  it('listClients maps rows', async () => {
    const { prisma } = makeFake();
    const clients = await listClients(prisma, 't1');
    expect(clients).toHaveLength(1);
    expect(clients[0]!.email).toBe('billing@acme.test');
  });

  it('createClient surfaces a unique-email conflict as P2002', async () => {
    const { prisma } = makeFake();
    await expect(
      createClient(prisma, 't1', {
        legalName: 'Dup',
        email: 'billing@acme.test',
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('tenant helpers map branding and update', async () => {
    const { prisma } = makeFake();
    const list = await listTenants(prisma);
    expect(list[0]!.branding?.primaryColor).toBe('#4F46E5');

    const got = await getTenant(prisma, 't1');
    expect(got?.slug).toBe('demo');

    const updated = await updateBranding(prisma, 't1', { displayName: 'Renamed' });
    expect(updated.branding?.displayName).toBe('Renamed');

    const created = await createTenant(prisma, {
      name: 'New',
      slug: 'new',
      dataMode: 'POOLED',
      baseCurrency: 'USD',
    });
    expect(created.id).toBe('t-new');
  });

  it('getStats counts statuses and sums outstanding', async () => {
    const { prisma } = makeFake();
    const stats = await getStats(prisma, 't1');
    expect(stats.draft).toBe(0);
    expect(stats.sent).toBe(1);
    expect(stats.paid).toBe(1);
    expect(stats.overdue).toBe(1);
    // outstanding = inv1 (1000, sent) + inv2 (10000-4000=6000, overdue) = 7000
    expect(stats.outstandingMinor).toBe(7000);
    // totalBilled = 1000 + 10000 + 2000 = 13000
    expect(stats.totalBilledMinor).toBe(13000);
  });
});

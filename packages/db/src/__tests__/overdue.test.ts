import { describe, it, expect } from 'vitest';
import { detectOverdue } from '../domain/overdue.js';
import type { TenantId } from '@invoice-saas/contracts';

/**
 * In-memory fake Prisma supporting the exact surface T4's `detectOverdue` touches
 * (`invoice.findMany` for candidates, and inside the `$transaction`: `invoice.findFirst`
 * re-check, `invoice.update`, `job.create`). No database required. Mirrors the fake
 * style of mark-sent.test.ts / payments.test.ts.
 */
const DAY = 24 * 60 * 60 * 1000;

interface InvoiceRow {
  id: string;
  tenantId: string;
  clientId: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: unknown;
  discount: unknown;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  paymentLink: string | null;
  createdAt: Date;
}

function makeInvoice(
  status: string,
  totalMinor: number,
  amountPaidMinor: number,
  dueDate: Date,
  tenantId: string,
  id = 'inv_x',
): InvoiceRow {
  return {
    id,
    tenantId,
    clientId: 'c1',
    invoiceNumber: id,
    status,
    currency: 'USD',
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate,
    lineItems: [],
    discount: null,
    subtotalMinor: totalMinor,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor,
    amountPaidMinor,
    paymentLink: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function makeFakePrisma(initial: InvoiceRow[]) {
  const store = {
    invoices: new Map<string, InvoiceRow>(),
    jobs: [] as Array<{ type: string; payload: Record<string, unknown>; availableAt: Date }>,
  };
  for (const r of initial) store.invoices.set(r.id, r);

  const invoiceModels = () => ({
    findMany: async (args: {
      where?: { tenantId?: string; status?: string; dueDate?: { lt: Date } };
    }) => {
      let rows = [...store.invoices.values()];
      if (args?.where?.tenantId) rows = rows.filter((r) => r.tenantId === args.where!.tenantId);
      if (args?.where?.status) rows = rows.filter((r) => r.status === args.where!.status);
      if (args?.where?.dueDate?.lt) {
        const asOf = args.where!.dueDate!.lt.getTime();
        rows = rows.filter((r) => r.dueDate.getTime() < asOf);
      }
      return rows;
    },
    findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
      const row = store.invoices.get(args.where.id);
      if (!row) return null;
      if (args.where.tenantId && row.tenantId !== args.where.tenantId) return null;
      return row;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = store.invoices.get(args.where.id);
      if (!row) throw new Error('INVOICE_NOT_FOUND');
      Object.assign(row, args.data);
      return row;
    },
  });

  const prisma: any = {
    $transaction: async (fn: (tx: {
      invoice: ReturnType<typeof invoiceModels>;
      job: { create: (a: { data: { type: string; payload: Record<string, unknown>; availableAt: Date } }) => Promise<unknown> };
    }) => Promise<unknown>) =>
      fn({
        invoice: invoiceModels(),
        job: {
          create: async (a: { data: { type: string; payload: Record<string, unknown>; availableAt: Date } }) => {
            store.jobs.push(a.data);
            return {};
          },
        },
      }),
    invoice: invoiceModels(),
    job: {
      create: async (a: { data: { type: string; payload: Record<string, unknown>; availableAt: Date } }) => {
        store.jobs.push(a.data);
        return {};
      },
    },
  };
  return { prisma, store };
}

const ASOF = new Date('2026-02-01T00:00:00Z');

describe('detectOverdue — T4 overdue sweep', () => {
  it('flips a sent, past-due, unpaid invoice to overdue and enqueues 3 reminder jobs at +1/+7/+14d', async () => {
    const due = new Date('2026-01-15T00:00:00Z');
    const inv = makeInvoice('sent', 1000, 0, due, 't1', 'inv1');
    const { prisma, store } = makeFakePrisma([inv]);

    const result = await detectOverdue(prisma, 't1' as TenantId, ASOF);

    expect(result.flipped).toBe(1);
    expect(store.invoices.get('inv1')!.status).toBe('overdue');
    expect(store.jobs).toHaveLength(3);

    const offsets = store.jobs
      .map((j) => j.availableAt.getTime() - due.getTime())
      .sort((a, b) => a - b);
    expect(offsets).toEqual([1 * DAY, 7 * DAY, 14 * DAY]);

    for (const j of store.jobs) {
      expect(j.type).toBe('INVOICE_REMINDER');
      expect(j.payload.invoiceId).toBe('inv1');
      expect(j.payload.tenantId).toBe('t1');
      expect(j.payload.reminderIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('does NOT flip a paid invoice', async () => {
    const inv = makeInvoice('paid', 1000, 1000, new Date('2026-01-15T00:00:00Z'), 't1', 'inv1');
    const { prisma, store } = makeFakePrisma([inv]);

    const result = await detectOverdue(prisma, 't1' as TenantId, ASOF);

    expect(result.flipped).toBe(0);
    expect(store.invoices.get('inv1')!.status).toBe('paid');
    expect(store.jobs).toHaveLength(0);
  });

  it('does NOT flip a void invoice', async () => {
    const inv = makeInvoice('void', 1000, 0, new Date('2026-01-15T00:00:00Z'), 't1', 'inv1');
    const { prisma, store } = makeFakePrisma([inv]);

    const result = await detectOverdue(prisma, 't1' as TenantId, ASOF);

    expect(result.flipped).toBe(0);
    expect(store.invoices.get('inv1')!.status).toBe('void');
    expect(store.jobs).toHaveLength(0);
  });

  it('does NOT flip a sent invoice that is already fully paid (balance 0)', async () => {
    const inv = makeInvoice('sent', 1000, 1000, new Date('2026-01-15T00:00:00Z'), 't1', 'inv1');
    const { prisma, store } = makeFakePrisma([inv]);

    const result = await detectOverdue(prisma, 't1' as TenantId, ASOF);

    expect(result.flipped).toBe(0);
    expect(store.invoices.get('inv1')!.status).toBe('sent');
    expect(store.jobs).toHaveLength(0);
  });

  it('is tenant-scoped: a sweep for tenant A leaves tenant B untouched', async () => {
    const due = new Date('2026-01-15T00:00:00Z');
    const a = makeInvoice('sent', 1000, 0, due, 'tA', 'invA');
    const b = makeInvoice('sent', 1000, 0, due, 'tB', 'invB');
    const { prisma, store } = makeFakePrisma([a, b]);

    const result = await detectOverdue(prisma, 'tA' as TenantId, ASOF);

    expect(result.flipped).toBe(1);
    expect(store.invoices.get('invA')!.status).toBe('overdue');
    expect(store.invoices.get('invB')!.status).toBe('sent'); // untouched
    expect(store.jobs.every((j) => j.payload.tenantId === 'tA')).toBe(true);
  });

  it('is idempotent across re-runs: a second sweep does not re-enqueue reminders', async () => {
    const due = new Date('2026-01-15T00:00:00Z');
    const inv = makeInvoice('sent', 1000, 0, due, 't1', 'inv1');
    const { prisma, store } = makeFakePrisma([inv]);

    await detectOverdue(prisma, 't1' as TenantId, ASOF);
    await detectOverdue(prisma, 't1' as TenantId, ASOF);

    // Already 'overdue' on the second pass → no further flips, no duplicate jobs.
    expect(store.invoices.get('inv1')!.status).toBe('overdue');
    expect(store.jobs).toHaveLength(3);
  });
});

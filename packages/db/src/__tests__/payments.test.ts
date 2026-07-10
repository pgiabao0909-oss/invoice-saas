import { describe, it, expect } from 'vitest';
import { createInvoice, markSent } from '../domain/invoices.js';
import { ensurePaymentLink, recordPayment } from '../domain/payments.js';
import { FakePaymentProvider } from '../integrations/stripe.js';
import type { InvoiceCreate, TenantId } from '@invoice-saas/contracts';

/**
 * In-memory fake Prisma that supports the exact surface T3's domain functions touch
 * (createInvoice / markSent / ensurePaymentLink / recordPayment) — including the
 * `payment` table's (tenantId, idempotencyKey) UNIQUE backstop. Mirrors the fake
 * style of mark-sent.test.ts so no database is required.
 */
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

interface PaymentRow {
  id: string;
  invoiceId: string;
  tenantId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  stripeChargeId: string | null;
}

function makeInvoice(
  status: string,
  totalMinor: number,
  amountPaidMinor: number,
  currency: string,
  id = 'inv_x',
  tenantId: TenantId = 't1' as TenantId,
): InvoiceRow {
  return {
    id,
    tenantId,
    clientId: 'c1',
    invoiceNumber: 'INV-X',
    status,
    currency,
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2026-01-15T00:00:00Z'),
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

function makeFakePrisma(initial: InvoiceRow[] = []) {
  const store = {
    invoices: new Map<string, InvoiceRow>(),
    payments: [] as PaymentRow[],
  };
  for (const r of initial) store.invoices.set(r.id, r);
  let counter = 0;
  const genId = (p: string) => `${p}_${counter++}`;

  const models = () => ({
    invoice: {
      findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
        const row = store.invoices.get(args.where.id);
        if (!row) return null;
        if (args.where.tenantId && row.tenantId !== args.where.tenantId) return null;
        return row;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const id = genId('inv');
        const row: InvoiceRow = {
          id,
          tenantId: args.data.tenantId as string,
          clientId: args.data.clientId as string,
          invoiceNumber: args.data.invoiceNumber as string,
          status: (args.data.status as string) ?? 'draft',
          currency: args.data.currency as string,
          issueDate: new Date(),
          dueDate: args.data.dueDate as Date,
          lineItems: args.data.lineItems,
          discount: (args.data.discount as unknown) ?? null,
          subtotalMinor: args.data.subtotalMinor as number,
          taxMinor: args.data.taxMinor as number,
          discountMinor: args.data.discountMinor as number,
          totalMinor: args.data.totalMinor as number,
          amountPaidMinor: 0,
          paymentLink: null,
          createdAt: new Date(),
        };
        store.invoices.set(id, row);
        return row;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.invoices.get(args.where.id);
        if (!row) throw new Error('INVOICE_NOT_FOUND');
        Object.assign(row, args.data);
        return row;
      },
    },
    taxRate: { findMany: async () => [] },
    client: { findUnique: async () => ({ id: 'c1', email: 'billing@acme.test' }) },
    outboxMessage: { create: async () => ({}) },
    auditLog: { create: async () => ({}) },
    job: { create: async () => ({}) },
    payment: {
      findFirst: async (args: { where: { tenantId: string; idempotencyKey: string } }) => {
        return (
          store.payments.find(
            (p) => p.tenantId === args.where.tenantId && p.idempotencyKey === args.where.idempotencyKey,
          ) ?? null
        );
      },
      create: async (args: { data: Omit<PaymentRow, 'id'> }) => {
        // Backstop for the (tenantId, idempotencyKey) unique constraint.
        const exists = store.payments.find(
          (p) => p.tenantId === args.data.tenantId && p.idempotencyKey === args.data.idempotencyKey,
        );
        if (exists) {
          const err = new Error('Unique constraint failed on (tenantId, idempotencyKey)') as Error & {
            code?: string;
          };
          err.code = 'P2002';
          throw err;
        }
        const row: PaymentRow = { id: genId('pay'), ...args.data };
        store.payments.push(row);
        return row;
      },
    },
  });

  const prisma: any = {
    $transaction: async (fn: (tx: ReturnType<typeof models>) => Promise<unknown>) => fn(models()),
    ...models(),
  };
  return { prisma, store };
}

describe('recordPayment — T3 payment ingestion', () => {
  it('is idempotent: same idempotencyKey twice creates only ONE Payment row', async () => {
    const inv = makeInvoice('sent', 1000, 0, 'USD');
    const { prisma, store } = makeFakePrisma([inv]);
    const r1 = await recordPayment(prisma, 't1' as TenantId, inv.id, {
      amountMinor: 1000,
      currency: 'USD',
      idempotencyKey: 'idem_1',
    });
    const r2 = await recordPayment(prisma, 't1' as TenantId, inv.id, {
      amountMinor: 1000,
      currency: 'USD',
      idempotencyKey: 'idem_1',
    });
    expect(r1.status).toBe('paid');
    expect(r2.status).toBe('paid');
    expect(r2.amountPaidMinor).toBe(1000); // NOT doubled to 2000
    expect(store.payments).toHaveLength(1);
  });

  it('records a partial payment without transitioning to paid', async () => {
    const inv = makeInvoice('sent', 1000, 0, 'USD');
    const { prisma } = makeFakePrisma([inv]);
    const r = await recordPayment(prisma, 't1' as TenantId, inv.id, {
      amountMinor: 400,
      currency: 'USD',
      idempotencyKey: 'idem_2',
    });
    expect(r.status).toBe('sent');
    expect(r.amountPaidMinor).toBe(400);
  });

  it('transitions sent → paid on a full payment', async () => {
    const inv = makeInvoice('sent', 1000, 0, 'USD');
    const { prisma } = makeFakePrisma([inv]);
    const r = await recordPayment(prisma, 't1' as TenantId, inv.id, {
      amountMinor: 1000,
      currency: 'USD',
      idempotencyKey: 'idem_3',
    });
    expect(r.status).toBe('paid');
    expect(r.amountPaidMinor).toBe(1000);
  });

  it('rejects recording against a draft invoice (ILLEGAL_TRANSITION)', async () => {
    const inv = makeInvoice('draft', 1000, 0, 'USD');
    const { prisma } = makeFakePrisma([inv]);
    await expect(
      recordPayment(prisma, 't1' as TenantId, inv.id, {
        amountMinor: 1000,
        currency: 'USD',
        idempotencyKey: 'idem_4',
      }),
    ).rejects.toThrow('ILLEGAL_TRANSITION');
  });

  it('rejects recording against a void invoice (ILLEGAL_TRANSITION)', async () => {
    const inv = makeInvoice('void', 1000, 0, 'USD');
    const { prisma } = makeFakePrisma([inv]);
    await expect(
      recordPayment(prisma, 't1' as TenantId, inv.id, {
        amountMinor: 1000,
        currency: 'USD',
        idempotencyKey: 'idem_5',
      }),
    ).rejects.toThrow('ILLEGAL_TRANSITION');
  });

  it('rejects a NEW key on an already-paid invoice (ALREADY_PAID) but a duplicate key is a safe no-op', async () => {
    const inv = makeInvoice('sent', 1000, 0, 'USD');
    const { prisma } = makeFakePrisma([inv]);
    const paid = await recordPayment(prisma, 't1' as TenantId, inv.id, {
      amountMinor: 1000,
      currency: 'USD',
      idempotencyKey: 'A',
    });
    expect(paid.status).toBe('paid');

    // A genuinely different key arriving after paid must NOT add money.
    await expect(
      recordPayment(prisma, 't1' as TenantId, inv.id, {
        amountMinor: 100,
        currency: 'USD',
        idempotencyKey: 'B',
      }),
    ).rejects.toThrow('ALREADY_PAID');

    // A retry with the same key is a no-op (idempotency), not an error.
    const retry = await recordPayment(prisma, 't1' as TenantId, inv.id, {
      amountMinor: 1000,
      currency: 'USD',
      idempotencyKey: 'A',
    });
    expect(retry.status).toBe('paid');
    expect(retry.amountPaidMinor).toBe(1000);
  });

  it('throws INVOICE_NOT_FOUND for an unknown invoice', async () => {
    const { prisma } = makeFakePrisma();
    await expect(
      recordPayment(prisma, 't1' as TenantId, 'ghost', {
        amountMinor: 100,
        currency: 'USD',
        idempotencyKey: 'idem_x',
      }),
    ).rejects.toThrow('INVOICE_NOT_FOUND');
  });
});

describe('ensurePaymentLink — T3 payment-link creation', () => {
  it('calls the provider exactly once across repeated calls (idempotent)', async () => {
    const { prisma } = makeFakePrisma();
    const input: InvoiceCreate = {
      clientId: 'c1' as any,
      currency: 'USD',
      dueDate: '2026-01-15T00:00:00Z',
      lineItems: [{ description: 'Widget', quantity: 1, unitPriceMinor: 1000 }],
    };
    const created = await createInvoice(prisma, 't1' as TenantId, input);
    const sent = await markSent(prisma, 't1' as TenantId, created.id);
    expect(sent.status).toBe('sent');

    const provider = new FakePaymentProvider();
    const url1 = await ensurePaymentLink(provider, prisma, 't1' as TenantId, {
      id: created.id,
      tenantId: 't1' as TenantId,
    });
    const url2 = await ensurePaymentLink(provider, prisma, 't1' as TenantId, {
      id: created.id,
      tenantId: 't1' as TenantId,
    });

    expect(provider.callCount).toBe(1);
    expect(url1).toBe(url2);
    expect(url1).toContain('https://pay.test/invoice/');
    // persisted on the invoice
    const stored = await (prisma as any).invoice.findFirst({ where: { id: created.id } });
    expect(stored.paymentLink).toBe(url1);
  });
});

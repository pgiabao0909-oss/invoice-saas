import { describe, it, expect } from 'vitest';
import { reconcilePayments } from '../domain/payments.js';
import type { PaymentProvider, ReconcilePayment } from '../integrations/stripe.js';
import type { InvoiceId, TenantId } from '@invoice-saas/contracts';

/**
 * Exercises the C4 payment-reconciliation safety net against an in-memory Prisma
 * (no DB). A listCompletedCharges stub stands in for the Stripe provider. Asserts:
 *  - a charge for a still-'sent' invoice is APPLIED (invoice -> paid);
 *  - a charge for an already-'paid' invoice is SKIPPED (idempotent, no double-apply);
 *  - a charge for a missing invoice is SKIPPED (terminal, doesn't throw).
 */
function makeFakePrisma() {
  const store = {
    invoices: new Map<string, any>(),
    payments: [] as Array<any>,
  };
  let seq = 0;

  const prisma: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma),
    invoice: {
      findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
        const r = store.invoices.get(args.where.id);
        if (!r) return null;
        if (args.where.tenantId && r.tenantId !== args.where.tenantId) return null;
        return r;
      },
      update: async (a: { where: { id: string }; data: any }) => {
        const r = store.invoices.get(a.where.id);
        if (!r) throw new Error('INVOICE_NOT_FOUND');
        Object.assign(r, a.data);
        return r;
      },
    },
    payment: {
      findFirst: async (args: { where: { tenantId: string; idempotencyKey: string } }) =>
        store.payments.find(
          (p) => p.tenantId === args.where.tenantId && p.idempotencyKey === args.where.idempotencyKey,
        ) ?? null,
      create: async (a: { data: any }) => {
        const p = { id: `pay${++seq}`, ...a.data };
        store.payments.push(p);
        return p;
      },
    },
  };
  return { prisma, store };
}

// Build a complete invoice row so mapInvoice (which reads clientId, invoiceNumber,
// currency, createdAt, lineItems, discount, issueDate, dueDate) doesn't hit undefined.
function makeInvoice(over: Partial<any> = {}): any {
  return {
    clientId: 'c1',
    invoiceNumber: 'INV-1',
    currency: 'USD',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    lineItems: [],
    discount: null,
    ...over,
  };
}

function stubProvider(charges: ReconcilePayment[]): PaymentProvider {
  return {
    createPaymentLink: async () => ({ url: 'https://pay.test/x' }),
    verifyWebhookSignature: () => true,
    parseEvent: () => ({ type: '', eventId: '', tenantId: '', invoiceId: '', amountMinor: 0, currency: 'USD', idempotencyKey: '' }),
    listCompletedCharges: async () => charges,
  };
}

describe('reconcilePayments — C4 missed-webhook recovery', () => {
  it('applies a charge for a still-sent invoice (recovers a missed webhook)', async () => {
    const { prisma, store } = makeFakePrisma();
    store.invoices.set('inv1', makeInvoice({
      id: 'inv1',
      tenantId: 't1',
      status: 'sent',
      subtotalMinor: 5000,
      taxMinor: 0,
      discountMinor: 0,
      totalMinor: 5000,
      amountPaidMinor: 0,
      paymentLink: null,
      issueDate: new Date('2026-01-01T00:00:00Z'),
      dueDate: new Date('2026-01-15T00:00:00Z'),
    }));

    const r = await reconcilePayments(
      prisma,
      stubProvider([{ eventId: 'evt_1', tenantId: 't1', invoiceId: 'inv1', amountMinor: 5000, currency: 'USD', idempotencyKey: 'idem_1' }]),
    );

    expect(r.applied).toBe(1);
    expect(r.skipped).toBe(0);
    const inv = store.invoices.get('inv1')!;
    expect(inv.status).toBe('paid');
    expect(inv.amountPaidMinor).toBe(5000);
  });

  it('skips an already-paid invoice (idempotent replay, no double-apply)', async () => {
    const { prisma, store } = makeFakePrisma();
    store.invoices.set('inv1', makeInvoice({
      id: 'inv1',
      tenantId: 't1',
      status: 'paid',
      subtotalMinor: 5000,
      taxMinor: 0,
      discountMinor: 0,
      totalMinor: 5000,
      amountPaidMinor: 5000,
      paymentLink: null,
      issueDate: new Date('2026-01-01T00:00:00Z'),
      dueDate: new Date('2026-01-15T00:00:00Z'),
    }));

    const r = await reconcilePayments(
      prisma,
      stubProvider([{ eventId: 'evt_2', tenantId: 't1', invoiceId: 'inv1', amountMinor: 5000, currency: 'USD', idempotencyKey: 'idem_2' }]),
    );

    expect(r.applied).toBe(0);
    expect(r.skipped).toBe(1);
    expect(store.payments).toHaveLength(0); // no second Payment row
  });

  it('skips a charge for a missing invoice (terminal, does not throw)', async () => {
    const { prisma } = makeFakePrisma();
    const r = await reconcilePayments(
      prisma,
      stubProvider([{ eventId: 'evt_3', tenantId: 't1', invoiceId: 'ghost', amountMinor: 100, currency: 'USD', idempotencyKey: 'idem_3' }]),
    );
    expect(r.applied).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it('treats an empty charge list as a no-op', async () => {
    const { prisma } = makeFakePrisma();
    const r = await reconcilePayments(prisma, stubProvider([]));
    expect(r).toEqual({ scanned: 0, applied: 0, skipped: 0 });
  });
});

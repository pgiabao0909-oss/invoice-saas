import { describe, it, expect } from 'vitest';
import { markSent } from '../domain/invoices.js';

/**
 * Fake Prisma that exercises markSent's transaction without a database, so we can
 * assert T2's acceptance criteria: draft → sent transition, outbox + EMAIL_INVOICE
 * job enqueued in the same transaction, and rejection when the invoice isn't draft.
 */
function fakePrisma(initialStatus: 'draft' | 'sent') {
  const calls = { update: 0, outbox: 0, job: 0 };
  const store = {
    invoice: {
      id: 'inv1',
      tenantId: 't1',
      clientId: 'c1',
      invoiceNumber: 'INV-1',
      status: initialStatus,
      currency: 'USD',
      issueDate: new Date('2026-01-01T00:00:00Z'),
      dueDate: new Date('2026-01-15T00:00:00Z'),
      lineItems: [{ description: 'Widget', quantity: 1, unitPriceMinor: 1000 }],
      discount: null,
      subtotalMinor: 1000,
      taxMinor: 200,
      discountMinor: 0,
      totalMinor: 1200,
      amountPaidMinor: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  };
  const tx: any = {
    invoice: {
      findFirst: async () => store.invoice,
      update: async (args: any) => {
        calls.update++;
        return { ...store.invoice, ...args.data };
      },
    },
    outboxMessage: { create: async () => { calls.outbox++; return {}; } },
    job: { create: async () => { calls.job++; return {}; } },
  };
  const prisma: any = { $transaction: async (fn: (t: any) => Promise<unknown>) => fn(tx) };
  return { prisma, calls };
}

describe('markSent (T2 — send transition)', () => {
  it('transitions draft → sent and enqueues the EMAIL_INVOICE job', async () => {
    const { prisma, calls } = fakePrisma('draft');
    const invoice = await markSent(prisma, 't1', 'inv1');
    expect(invoice.status).toBe('sent');
    expect(calls.update).toBe(1);
    expect(calls.outbox).toBe(1);
    expect(calls.job).toBe(1);
  });

  it('rejects sending a non-draft invoice (maps to HTTP 409)', async () => {
    const { prisma } = fakePrisma('sent');
    await expect(markSent(prisma, 't1', 'inv1')).rejects.toThrow('INVOICE_NOT_DRAFT');
  });

  it('rejects a missing invoice (maps to HTTP 404)', async () => {
    const { prisma } = fakePrisma('draft');
    (prisma as any).$transaction = async (fn: (t: any) => Promise<unknown>) =>
      fn({
        invoice: { findFirst: async () => null, update: async () => ({}) },
        outboxMessage: { create: async () => ({}) },
        job: { create: async () => ({}) },
      });
    await expect(markSent(prisma, 't1', 'inv1')).rejects.toThrow('INVOICE_NOT_FOUND');
  });
});

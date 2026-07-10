import { describe, it, expect } from 'vitest';
import { handleEmailInvoice } from '../worker.js';
import { FakePaymentProvider } from '@invoice-saas/db';

/**
 * T3 — the EMAIL_INVOICE job must send an email whose body contains the idempotent
 * Stripe payment link. Mirrors pdf.test.ts: we exercise the extracted, testable
 * `handleEmailInvoice` with a fake Prisma + a capturing email sender + the fake
 * provider, so no network or DB is required.
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

class CapturingEmailSender {
  sent: Array<{ to: string; subject: string; body: string }> = [];
  async sendInvoice(input: { to: string; subject: string; body: string }): Promise<void> {
    this.sent.push(input);
  }
}

function fakePrisma() {
  const invoice: InvoiceRow = {
    id: 'inv1',
    tenantId: 't1',
    clientId: 'c1',
    invoiceNumber: 'INV-1',
    status: 'sent',
    currency: 'USD',
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2026-01-15T00:00:00Z'),
    lineItems: [],
    discount: null,
    subtotalMinor: 1000,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor: 1000,
    amountPaidMinor: 0,
    paymentLink: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const prisma: any = {
    invoice: {
      findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
        if (args.where.tenantId && invoice.tenantId !== args.where.tenantId) return null;
        return invoice;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(invoice, args.data);
        return invoice;
      },
    },
    tenant: { findUnique: async () => ({ id: 't1', name: 'Acme', branding: null }) },
    client: { findUnique: async () => ({ id: 'c1', email: 'client@example.com' }) },
    $transaction: async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        invoice: {
          findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
            if (args.where.tenantId && invoice.tenantId !== args.where.tenantId) return null;
            return invoice;
          },
          update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            Object.assign(invoice, args.data);
            return invoice;
          },
        },
      }),
  };
  return { prisma, invoice };
}

describe('handleEmailInvoice — T3 payment link in email', () => {
  it('emails the invoice with the idempotent payment link in the body', async () => {
    const { prisma, invoice } = fakePrisma();
    const email = new CapturingEmailSender();
    const provider = new FakePaymentProvider();

    await handleEmailInvoice(
      { prisma, email, provider },
      { type: 'EMAIL_INVOICE', id: 'job1', payload: { invoiceId: 'inv1', tenantId: 't1' } } as any,
    );

    expect(email.sent).toHaveLength(1);
    const body = email.sent[0]!.body;
    expect(body).toContain('Pay online:');
    expect(body).toContain('https://pay.test/invoice/inv1');
    // provider called exactly once (idempotent)
    expect(provider.callCount).toBe(1);
    // link persisted on the invoice
    expect(invoice.paymentLink).toBe('https://pay.test/invoice/inv1');
  });
});

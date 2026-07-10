import { describe, it, expect } from 'vitest';
import { handleReminder } from '../worker.js';
import type { EmailSender } from '../email.js';

/**
 * T4 — the INVOICE_REMINDER job must send an email to the client for an overdue
 * invoice, and must NOT email when the invoice is no longer outstanding (a stale
 * job fired after the invoice was paid/void). Mirrors email-link.test.ts: extracted
 * `handleReminder` + a capturing sender, no network or DB.
 */
class CapturingEmailSender implements EmailSender {
  sent: Array<{ to: string; subject: string; body: string }> = [];
  async sendInvoice(input: { to: string; subject: string; body: string }): Promise<void> {
    this.sent.push(input);
  }
}

interface InvoiceRow {
  id: string;
  tenantId: string;
  clientId: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  dueDate: Date;
}

function fakePrisma(status: string) {
  const invoice: InvoiceRow = {
    id: 'inv1',
    tenantId: 't1',
    clientId: 'c1',
    invoiceNumber: 'INV-1',
    status,
    currency: 'USD',
    dueDate: new Date('2026-01-15T00:00:00Z'),
  };
  const prisma: any = {
    invoice: {
      findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
        if (args.where.tenantId && invoice.tenantId !== args.where.tenantId) return null;
        return invoice;
      },
    },
    client: { findUnique: async () => ({ id: 'c1', email: 'client@example.com' }) },
  };
  return { prisma, invoice };
}

const reminderJob = {
  type: 'INVOICE_REMINDER',
  id: 'job1',
  payload: { invoiceId: 'inv1', tenantId: 't1' },
} as any;

describe('handleReminder — T4 overdue reminder', () => {
  it('sends a reminder email to the client for an overdue invoice', async () => {
    const { prisma } = fakePrisma('overdue');
    const email = new CapturingEmailSender();

    await handleReminder({ prisma, email }, reminderJob);

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe('client@example.com');
    expect(email.sent[0]!.subject).toContain('Overdue');
    expect(email.sent[0]!.body).toContain('INV-1');
  });

  it('skips the reminder when the invoice is already paid (stale job)', async () => {
    const { prisma } = fakePrisma('paid');
    const email = new CapturingEmailSender();

    await handleReminder({ prisma, email }, reminderJob);

    expect(email.sent).toHaveLength(0);
  });

  it('skips the reminder when the invoice is void (stale job)', async () => {
    const { prisma } = fakePrisma('void');
    const email = new CapturingEmailSender();

    await handleReminder({ prisma, email }, reminderJob);

    expect(email.sent).toHaveLength(0);
  });
});

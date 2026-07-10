import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { Invoice, InvoiceId, TenantId } from '@invoice-saas/contracts';
import type { PaymentProvider } from '../integrations/stripe.js';
import { mapInvoice } from './invoices.js';

const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * T3 — ensure a Stripe-hosted payment link exists for an invoice.
 *
 * Idempotent: if the invoice already has a `paymentLink`, it is returned WITHOUT
 * calling the provider again. Otherwise the link is created in the SAME transaction
 * as the update, so a crash between create and persist can never leave a link-less
 * invoice that silently re-calls Stripe on retry.
 */
export async function ensurePaymentLink(
  provider: PaymentProvider,
  prisma: PrismaClient,
  tenantId: TenantId,
  invoice: Pick<Invoice, 'id' | 'tenantId'>,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoice.id, tenantId },
    });
    if (!existing) throw new Error('INVOICE_NOT_FOUND');
    // Idempotent: never re-call the provider for a link we already persisted.
    if (existing.paymentLink) return existing.paymentLink;

    const created = await provider.createPaymentLink({
      invoiceId: invoice.id,
      tenantId,
      amountMinor: existing.totalMinor - existing.amountPaidMinor,
      currency: existing.currency,
      description: `Invoice ${existing.invoiceNumber}`,
    });

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink: created.url },
    });
    return updated.paymentLink!;
  });
}

export interface RecordPaymentInput {
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  stripeChargeId?: string;
}

/**
 * T3 — record a payment against an invoice, transitioning sent/overdue → paid
 * when fully paid.
 *
 * Guards (in order):
 *  - INVOICE_NOT_FOUND if the invoice isn't visible to the tenant.
 *  - IDEMPOTENCY: if a Payment with (tenantId, idempotencyKey) already exists,
 *    return the current invoice state WITHOUT applying the money again. The unique
 *    constraint is the backstop — this short-circuit avoids even attempting the
 *    second insert.
 *  - ILLEGAL_TRANSITION: payments may only be recorded from 'sent' or 'overdue'.
 *    A 'draft' or 'void' invoice rejects. An already-'paid' invoice that receives a
 *    NEW idempotencyKey also rejects (ALREADY_PAID) — it must not accrue more money.
 *    But a duplicate idempotencyKey on a paid invoice is a safe no-op (idempotency).
 */
export async function recordPayment(
  prisma: PrismaClient,
  tenantId: TenantId,
  invoiceId: InvoiceId,
  input: RecordPaymentInput,
): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!existing) throw new Error('INVOICE_NOT_FOUND');

    // Idempotency backstop: a retry with the same key is a no-op (no double-apply).
    const prior = await tx.payment.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    });
    if (prior) return mapInvoice(existing);

    // Illegal transitions: only sent/overdue may accrue payments.
    if (existing.status === 'paid') {
      // A *different* key arriving after paid is a genuine double-charge attempt.
      throw new Error('ALREADY_PAID');
    }
    if (existing.status === 'draft' || existing.status === 'void') {
      throw new Error('ILLEGAL_TRANSITION');
    }

    await tx.payment.create({
      data: {
        invoiceId,
        tenantId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        stripeChargeId: input.stripeChargeId,
      },
    });

    const amountPaidMinor = existing.amountPaidMinor + input.amountMinor;
    const status =
      amountPaidMinor >= existing.totalMinor ? 'paid' : existing.status;

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaidMinor, status },
    });

    return mapInvoice(updated);
  });
}

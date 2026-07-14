import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { Invoice as PrismaInvoice } from '@prisma/client';
import { computeTotals, AUDIT_EVENTS } from '@invoice-saas/contracts';
import type {
  Discount,
  Invoice,
  InvoiceCreate,
  InvoiceId,
  LineItem,
  TenantId,
} from '@invoice-saas/contracts';
import { verifyInvoice } from './verify.js';
import { recordAudit } from './audit.js';

const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export function mapInvoice(r: PrismaInvoice): Invoice {
  return {
    id: r.id,
    tenantId: r.tenantId,
    clientId: r.clientId,
    invoiceNumber: r.invoiceNumber,
    status: r.status,
    currency: r.currency,
    issueDate: r.issueDate.toISOString(),
    dueDate: r.dueDate.toISOString(),
    lineItems: r.lineItems as unknown as LineItem[],
    discount: r.discount ? (r.discount as Discount) : undefined,
    totals: {
      subtotalMinor: r.subtotalMinor,
      taxMinor: r.taxMinor,
      discountMinor: r.discountMinor,
      totalMinor: r.totalMinor,
    },
    amountPaidMinor: r.amountPaidMinor,
    paymentLink: r.paymentLink ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * T1 — create a draft invoice. Totals are computed per-line (banker's rounding)
 * and stored denormalized so reads never recompute. Returns the full Invoice.
 */
export async function createInvoice(
  prisma: PrismaClient,
  tenantId: TenantId,
  input: InvoiceCreate,
): Promise<Invoice> {
  const taxRates = await prisma.taxRate.findMany({ where: { tenantId } });
  const totals = computeTotals(input.lineItems, taxRates, input.discount);

  const created = await prisma.invoice.create({
    data: {
      tenantId,
      clientId: input.clientId,
      currency: input.currency,
      dueDate: new Date(input.dueDate),
      lineItems: toJson(input.lineItems),
      discount: input.discount ? toJson(input.discount) : undefined,
      // Per-tenant sequence is an Open Question in CONTEXT.md; timestamp slug for now.
      invoiceNumber: `INV-${Date.now()}`,
      subtotalMinor: totals.subtotalMinor,
      taxMinor: totals.taxMinor,
      discountMinor: totals.discountMinor,
      totalMinor: totals.totalMinor,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return mapInvoice(created);
}

/**
 * T2 (transition) — mark a draft invoice sent. Writes the OutboxMessage and the
 * EMAIL_INVOICE Job in the SAME transaction as the status change, so an event is
 * never lost or duplicated (ADR 0001 outbox). Caller must keep the scoped guard
 * intact — this function still re-checks `tenantId`.
 *
 * Verification gate (guide §2.4): before sending we run the self-check. A draft that
 * fails verification is NOT sent — instead the gate throws `VERIFICATION_FAILED` with
 * the issues attached, so a malformed invoice can never leave the building (manual
 * click OR automated ingest both go through this same guard). The success path
 * appends an immutable `invoice.sent` audit record in the same transaction.
 */
export async function markSent(
  prisma: PrismaClient,
  tenantId: TenantId,
  invoiceId: InvoiceId,
  opts: { source?: 'manual' | 'ingest' | 'recurring' } = {},
): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!existing) throw new Error('INVOICE_NOT_FOUND');
    if (existing.status !== 'draft') throw new Error('INVOICE_NOT_DRAFT');

    const client = await tx.client.findUnique({ where: { id: existing.clientId } });
    const result = verifyInvoice(
      {
        invoiceNumber: existing.invoiceNumber,
        currency: existing.currency,
        dueDate: existing.dueDate,
        lineItems: existing.lineItems as unknown as LineItem[],
        subtotalMinor: existing.subtotalMinor,
        taxMinor: existing.taxMinor,
        discountMinor: existing.discountMinor,
        totalMinor: existing.totalMinor,
        amountPaidMinor: existing.amountPaidMinor,
      },
      client?.email,
    );
    if (!result.ok) {
      const err = new Error('VERIFICATION_FAILED') as Error & { issues?: unknown };
      err.issues = result.issues;
      await recordAudit(tx as any, {
        tenantId,
        invoiceId: existing.id,
        event: AUDIT_EVENTS.INVOICE_VERIFICATION_FAILED,
        detail: { issues: result.issues },
      });
      throw err;
    }
    await recordAudit(tx as any, {
      tenantId,
      invoiceId: existing.id,
      event: AUDIT_EVENTS.INVOICE_VERIFIED,
      detail: { method: opts.source ?? 'manual' },
    });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'sent' },
    });

    await tx.outboxMessage.create({
      data: {
        tenantId,
        type: 'INVOICE_SENT',
        payload: toJson({ invoiceId, clientId: updated.clientId }),
      },
    });
    await tx.job.create({
      data: { type: 'EMAIL_INVOICE', payload: toJson({ invoiceId, tenantId }) },
    });
    await recordAudit(tx as any, {
      tenantId,
      invoiceId: existing.id,
      event: AUDIT_EVENTS.INVOICE_SENT,
    });

    return mapInvoice(updated);
  });
}

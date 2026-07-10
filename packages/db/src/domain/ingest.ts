import type { PrismaClient } from '@prisma/client';
import type {
  Ingest,
  IngestResult,
  Invoice,
  InvoiceId,
  TenantId,
} from '@invoice-saas/contracts';
import { AUDIT_EVENTS } from '@invoice-saas/contracts';
import { createClient } from './read.js';
import { createInvoice, markSent } from './invoices.js';
import { verifyInvoice } from './verify.js';
import { recordAudit } from './audit.js';

/**
 * The "set it and forget it" pipeline (guide §2.1 → §2.4 → §2.3).
 *
 * An upstream system pushes a unit of work (a sale, a completed project, a recurring
 * charge) to `POST /ingest`. This function turns it into an invoice and — when it
 * passes the self-verification gate — sends it, without any human in the loop:
 *
 *   1. Resolve the client by email (create-if-missing)  → reliable data source
 *   2. Create the draft invoice                          → dumb-simple generator
 *   3. Run verifyInvoice()                                → adversarial self-review
 *   4. If valid AND autoSend: markSent()                  → automated delivery
 *   5. Append immutable audit records at every step       → tamper-evident trail
 *
 * If verification fails, the invoice is HELD (never sent) and the failure is audited
 * so the operator can see exactly what was wrong. autoSend=false also holds it for a
 * later manual review — the invoice simply waits as a draft.
 */
export async function ingestWork(
  prisma: PrismaClient,
  tenantId: TenantId,
  input: Ingest,
  opts: { baseCurrency?: string } = {},
): Promise<IngestResult> {
  const currency = input.currency ?? opts.baseCurrency ?? 'USD';
  const dueDate = input.dueDate
    ? new Date(input.dueDate)
    : new Date(Date.now() + (input.dueInDays ?? 14) * 86_400_000);

  // 1. Resolve the client by email within the tenant (create-if-missing).
  const existing = await prisma.client.findFirst({
    where: { tenantId, email: input.client.email },
  });
  const client =
    existing ??
    (await createClient(prisma, tenantId, {
      legalName: input.client.legalName ?? input.client.email,
      email: input.client.email,
      billingAddress: input.client.billingAddress,
      taxIdentifier: input.client.taxIdentifier,
    }));

  // 2. Create the draft invoice (totals computed per-line, stored denormalized).
  const invoice: Invoice = await createInvoice(prisma, tenantId, {
    clientId: client.id,
    currency,
    dueDate: dueDate.toISOString(),
    lineItems: input.lineItems,
    discount: input.discount,
  });
  await recordAudit(prisma, {
    tenantId,
    invoiceId: invoice.id,
    event: AUDIT_EVENTS.INVOICE_CREATED,
    detail: { source: 'ingest' },
  });

  // 3. Self-verification gate.
  const verification = verifyInvoice(
    {
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      lineItems: invoice.lineItems,
      subtotalMinor: invoice.totals.subtotalMinor,
      taxMinor: invoice.totals.taxMinor,
      discountMinor: invoice.totals.discountMinor,
      totalMinor: invoice.totals.totalMinor,
      amountPaidMinor: invoice.amountPaidMinor,
    },
    client.email,
  );
  // A failed verification is audited here. A successful one is recorded inside
  // markSent — the single send gate shared by the ingest pipeline and the manual
  // UI send — so it is never double-counted.
  if (!verification.ok) {
    await recordAudit(prisma, {
      tenantId,
      invoiceId: invoice.id,
      event: AUDIT_EVENTS.INVOICE_VERIFICATION_FAILED,
      detail: { issues: verification.issues },
    });
  }

  // 4. Auto-deliver only when valid (and not explicitly held).
  const autoSend = input.autoSend ?? true;
  let autoSent = false;
  if (verification.ok && autoSend) {
    await markSent(prisma, tenantId, invoice.id as InvoiceId, { source: 'ingest' }); // audits verified + sent
    autoSent = true;
  } else {
    await recordAudit(prisma, {
      tenantId,
      invoiceId: invoice.id,
      event: AUDIT_EVENTS.INVOICE_HELD,
      detail: { reason: verification.ok ? 'autoSend_disabled' : 'verification_failed' },
    });
  }

  return { invoice, clientId: client.id, verification, autoSent };
}

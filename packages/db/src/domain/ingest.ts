import type { PrismaClient } from '@prisma/client';
import type { Invoice as PrismaInvoice } from '@prisma/client';
import type {
  Ingest,
  IngestResult,
  Invoice,
  InvoiceId,
  TenantId,
} from '@invoice-saas/contracts';
import { AUDIT_EVENTS } from '@invoice-saas/contracts';
import { createClient } from './read.js';
import { createInvoice, markSent, mapInvoice } from './invoices.js';
import { verifyInvoice } from './verify.js';
import { recordAudit } from './audit.js';

/**
 * The "set it and forget it" pipeline (guide §2.1 → §2.4 → §2.3).
 *
 * An upstream system pushes a unit of work (a sale, a completed project, a recurring
 * charge) to `POST /ingest`. This function turns it into an invoice and — when it
 * passes the self-verification gate — sends it, without any human in the loop:
 *
 *   1. (Idempotency) If `idempotencyKey` was seen before, return the original invoice
 *      — a retried upstream event never creates a duplicate (guide §C3).
 *   2. Resolve the client by email (create-if-missing)  → reliable data source
 *   3. Create the draft invoice                          → dumb-simple generator
 *   4. Run verifyInvoice()                                → adversarial self-review
 *   5. If valid AND autoSend: markSent()                  → automated delivery
 *   6. Append immutable audit records at every step       → tamper-evident trail
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

  // 1. Idempotency: a retried upstream event must not create a second invoice.
  if (input.idempotencyKey) {
    const prior = await prisma.invoice.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (prior) {
      return idempotentResult(prior, await clientEmail(prisma, prior.clientId));
    }
  }

  // 2. Resolve the client by email within the tenant (create-if-missing).
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

  // 3. Create the draft invoice (totals computed per-line, stored denormalized).
  //    Tolerates a concurrent duplicate insert of the same key: if the unique
  //    constraint fires, we re-read the winner and return it instead of throwing.
  let invoice: Invoice;
  try {
    invoice = await createInvoice(prisma, tenantId, {
      clientId: client.id,
      currency,
      dueDate: dueDate.toISOString(),
      lineItems: input.lineItems,
      discount: input.discount,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (err) {
    if (input.idempotencyKey && isUniqueIdempotencyViolation(err)) {
      const dup = await prisma.invoice.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (dup) return idempotentResult(dup, await clientEmail(prisma, dup.clientId));
    }
    throw err;
  }
  await recordAudit(prisma, {
    tenantId,
    invoiceId: invoice.id,
    event: AUDIT_EVENTS.INVOICE_CREATED,
    detail: { source: 'ingest' },
  });

  // 4. Self-verification gate.
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

  // 5. Auto-deliver only when valid (and not explicitly held).
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

/** Re-read an already-created invoice for an idempotent retry (guide §C3). */
async function idempotentResult(
  row: PrismaInvoice,
  clientEmail: string | undefined,
): Promise<IngestResult> {
  const inv = mapInvoice(row);
  const verification = verifyInvoice(
    {
      invoiceNumber: inv.invoiceNumber,
      currency: inv.currency,
      dueDate: inv.dueDate,
      lineItems: inv.lineItems,
      subtotalMinor: inv.totals.subtotalMinor,
      taxMinor: inv.totals.taxMinor,
      discountMinor: inv.totals.discountMinor,
      totalMinor: inv.totals.totalMinor,
      amountPaidMinor: inv.amountPaidMinor,
    },
    clientEmail,
  );
  return {
    invoice: inv,
    clientId: row.clientId,
    verification,
    autoSent: row.status !== 'draft',
  };
}

async function clientEmail(prisma: PrismaClient, clientId: string): Promise<string | undefined> {
  const c = await prisma.client.findUnique({ where: { id: clientId } });
  return c?.email;
}

/** True when a Prisma unique-constraint violation is on the invoice idempotencyKey. */
function isUniqueIdempotencyViolation(err: unknown): boolean {
  const e = err as { code?: string; meta?: { target?: string[] } };
  return (
    e?.code === 'P2002' &&
    Array.isArray(e.meta?.target) &&
    e.meta.target.includes('idempotencyKey')
  );
}

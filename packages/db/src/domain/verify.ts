import type { LineItem, VerificationResult, VerificationIssue } from '@invoice-saas/contracts';

/**
 * The self-verification gate (guide §2.4 — "the adversarial review").
 *
 * Before any invoice is sent, the system checks its OWN work and refuses to send a
 * bad one. These checks are deliberately provider-free and DB-free (pure), so they
 * run identically in the ingest pipeline, in `markSent`, and in unit tests.
 *
 * The math checks assert internal accounting identities that hold for ANY correct
 * invoice regardless of how tax was derived:
 *   - subtotal  = Σ(quantity × unitPrice)
 *   - total     = subtotal + tax − discount
 *   - no negative components; you cannot be paid more than you are owed.
 * The completeness checks assert the invoice can actually be delivered and booked:
 *   - a valid client email, a currency code, an invoice number, ≥1 line item, and a
 *     valid due date.
 *
 * Returns every issue found (not just the first) so the audit log captures the full
 * picture in one record.
 */

/** Minimal structural shape the gate needs — satisfied by both the mapped Invoice and a Prisma row. */
export interface VerifiableInvoice {
  invoiceNumber: string;
  currency: string;
  dueDate: Date | string;
  lineItems: LineItem[];
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
}

// Deliberately conservative; the contract layer already does strict email parsing
// on inbound data. This is the last-line defensive check at send time.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export function verifyInvoice(
  invoice: VerifiableInvoice,
  clientEmail: string | null | undefined,
): VerificationResult {
  const issues: VerificationIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });

  // --- Completeness ---------------------------------------------------------
  if (!clientEmail || !EMAIL_RE.test(clientEmail)) {
    add('CLIENT_EMAIL_MISSING', 'client has no valid email address to deliver to');
  }
  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim().length === 0) {
    add('INVOICE_NUMBER_MISSING', 'invoice number is empty');
  }
  if (!CURRENCY_RE.test(invoice.currency)) {
    add('CURRENCY_INVALID', `currency "${invoice.currency}" is not a 3-letter ISO code`);
  }
  if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
    add('NO_LINE_ITEMS', 'invoice has no line items');
  }
  const due = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
  if (Number.isNaN(due.getTime())) {
    add('DUE_DATE_INVALID', 'due date is not a valid date');
  }

  // --- Per-line sanity + subtotal identity ---------------------------------
  let computedSubtotal = 0;
  for (let i = 0; i < (invoice.lineItems?.length ?? 0); i++) {
    const li = invoice.lineItems[i]!;
    if (!(li.quantity > 0)) {
      add('LINE_QUANTITY_INVALID', `line ${i + 1} "${li.description}" has non-positive quantity`);
    }
    if (!(li.unitPriceMinor >= 0)) {
      add('LINE_PRICE_INVALID', `line ${i + 1} "${li.description}" has negative unit price`);
    }
    computedSubtotal += li.quantity * li.unitPriceMinor;
  }
  if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0 && computedSubtotal !== invoice.subtotalMinor) {
    add(
      'SUBTOTAL_MISMATCH',
      `subtotal ${invoice.subtotalMinor} ≠ Σ(qty × price) ${computedSubtotal}`,
    );
  }

  // --- Accounting identities -----------------------------------------------
  if (invoice.taxMinor < 0) add('TAX_NEGATIVE', 'tax is negative');
  if (invoice.discountMinor < 0) add('DISCOUNT_NEGATIVE', 'discount is negative');
  const expectedTotal = invoice.subtotalMinor + invoice.taxMinor - invoice.discountMinor;
  if (expectedTotal !== invoice.totalMinor) {
    add(
      'TOTAL_MISMATCH',
      `total ${invoice.totalMinor} ≠ subtotal + tax − discount ${expectedTotal}`,
    );
  }
  if (invoice.totalMinor < 0) add('TOTAL_NEGATIVE', 'total is negative');
  if (invoice.amountPaidMinor < 0) add('PAID_NEGATIVE', 'amount paid is negative');
  if (invoice.amountPaidMinor > invoice.totalMinor) {
    add('OVERPAID', `amount paid ${invoice.amountPaidMinor} exceeds total ${invoice.totalMinor}`);
  }

  return { ok: issues.length === 0, issues };
}

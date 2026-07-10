/**
 * Totals math now lives in `@invoice-saas/contracts` as the single source of truth
 * (ADR 0001) so web + db compute identically. Re-export here so existing importers
 * (`domain/invoices.ts`, tests) keep working without changes.
 */
export { roundHalfEven, computeTotals } from '@invoice-saas/contracts';
export type { InvoiceTotals } from '@invoice-saas/contracts';

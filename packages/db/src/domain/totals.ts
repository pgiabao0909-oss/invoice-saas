import type { Discount, LineItem, Money, TaxRate } from '@invoice-saas/contracts';

/**
 * Banker's rounding (round-half-to-even) to integer minor units.
 * Required for tax rounding parity with most jurisdictions and to avoid
 * systematic penny drift across millions of invoices (CONTEXT.md: Tax rounding).
 */
export function roundHalfEven(value: number): Money {
  const floor = Math.floor(value);
  const frac = value - floor;
  if (frac < 0.5) return floor;
  if (frac > 0.5) return floor + 1;
  // Exactly .5 → round to the nearest EVEN integer.
  return floor % 2 === 0 ? floor : floor + 1;
}

export interface InvoiceTotals {
  subtotalMinor: Money;
  taxMinor: Money;
  discountMinor: Money;
  totalMinor: Money;
}

/**
 * Computes invoice totals. Tax is calculated PER LINE ITEM (never on the
 * aggregated subtotal) and rounded with roundHalfEven, per CONTEXT.md. Pure
 * function — no DB — so it is unit-testable without infrastructure.
 */
export function computeTotals(
  lineItems: LineItem[],
  taxRates: TaxRate[],
  discount?: Discount,
): InvoiceTotals {
  let subtotal = 0;
  let tax = 0;

  for (const li of lineItems) {
    const lineGross = li.quantity * li.unitPriceMinor;
    subtotal += lineGross;

    const rate = li.taxRateId
      ? (taxRates.find((t) => t.id === li.taxRateId)?.rateBps ?? 0)
      : 0;
    // tax per line, in minor units, basis points → /10000
    tax += roundHalfEven((lineGross * rate) / 10000);
  }

  let discountMinor = 0;
  if (discount) {
    if (discount.amountMinor != null) {
      discountMinor = discount.amountMinor;
    } else if (discount.percentBps != null) {
      discountMinor = roundHalfEven((subtotal * discount.percentBps) / 10000);
    }
  }

  const totalMinor = Math.max(0, subtotal + tax - discountMinor);
  return { subtotalMinor: subtotal, taxMinor: tax, discountMinor, totalMinor };
}

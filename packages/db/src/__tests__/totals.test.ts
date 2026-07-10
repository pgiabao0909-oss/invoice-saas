import { describe, it, expect } from 'vitest';
import { roundHalfEven, computeTotals } from '../domain/totals.js';
import type { LineItem, TaxRate } from '@invoice-saas/contracts';

describe('roundHalfEven (banker’s rounding)', () => {
  it('rounds .5 to the nearest even integer', () => {
    expect(roundHalfEven(2.5)).toBe(2); // 2 is even
    expect(roundHalfEven(3.5)).toBe(4); // 4 is even
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
  });
  it('rounds non-half fractions normally', () => {
    expect(roundHalfEven(2.4)).toBe(2);
    expect(roundHalfEven(2.6)).toBe(3);
  });
});

const taxRates: TaxRate[] = [
  { id: 'tax_vat', code: 'VAT', jurisdiction: 'UK', rateBps: 2000 },
  { id: 'tax_none', code: 'NONE', jurisdiction: '—', rateBps: 0 },
];

describe('computeTotals', () => {
  it('computes per-line tax and totals', () => {
    const items: LineItem[] = [
      { description: 'Widget', quantity: 1, unitPriceMinor: 10000, taxRateId: 'tax_vat' },
    ];
    const t = computeTotals(items, taxRates);
    expect(t.subtotalMinor).toBe(10000);
    expect(t.taxMinor).toBe(2000); // 20% of 100.00 = 20.00
    expect(t.discountMinor).toBe(0);
    expect(t.totalMinor).toBe(12000);
  });

  it('applies a percentage discount on the subtotal', () => {
    const items: LineItem[] = [
      { description: 'Widget', quantity: 1, unitPriceMinor: 10000, taxRateId: 'tax_vat' },
    ];
    const t = computeTotals(items, taxRates, { percentBps: 1000 }); // 10% off
    expect(t.discountMinor).toBe(1000);
    expect(t.totalMinor).toBe(11000); // 100 + 20 tax - 10 discount
  });

  it('rounds tax PER LINE, not on the aggregate (CONTEXT.md rule)', () => {
    // Each line gross = 3333 minor units at 20% → 666.6 → roundHalfEven 667.
    // Two lines → 1334. Aggregated (6666 * 0.2 = 1333.2 → 1333) would differ.
    const items: LineItem[] = [
      { description: 'a', quantity: 1, unitPriceMinor: 3333, taxRateId: 'tax_vat' },
      { description: 'b', quantity: 1, unitPriceMinor: 3333, taxRateId: 'tax_vat' },
    ];
    const t = computeTotals(items, taxRates);
    expect(t.taxMinor).toBe(1334); // proves per-line rounding
    expect(t.subtotalMinor).toBe(6666);
    expect(t.totalMinor).toBe(8000); // 6666 + 1334
  });

  it('never produces a negative total', () => {
    const items: LineItem[] = [
      { description: 'a', quantity: 1, unitPriceMinor: 100, taxRateId: 'tax_none' },
    ];
    const t = computeTotals(items, taxRates, { amountMinor: 10000 });
    expect(t.totalMinor).toBe(0);
  });
});

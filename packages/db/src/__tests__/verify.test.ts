import { describe, it, expect } from 'vitest';
import { verifyInvoice } from '../domain/verify.js';
import type { LineItem } from '@invoice-saas/contracts';

const line = (quantity: number, unitPriceMinor: number, description = 'Item'): LineItem => ({
  description,
  quantity,
  unitPriceMinor: unitPriceMinor,
});

const valid = {
  invoiceNumber: 'INV-1',
  currency: 'USD',
  dueDate: '2026-01-15T00:00:00.000Z',
  lineItems: [line(2, 500)], // subtotal 1000
  subtotalMinor: 1000,
  taxMinor: 0,
  discountMinor: 0,
  totalMinor: 1000,
  amountPaidMinor: 0,
};

/**
 * The self-verification gate (guide §2.4). These are pure-function tests — no
 * database — proving the system refuses to send a malformed invoice and passes a
 * correct one. The same function is called by `markSent` and `ingestWork`, so this
 * is the single source of truth for "is this invoice safe to send?".
 */
describe('verifyInvoice — self-verification gate', () => {
  it('passes a well-formed invoice with a valid client email', () => {
    const r = verifyInvoice(valid, 'billing@acme.test');
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('rejects when the client has no deliverable email', () => {
    const r = verifyInvoice(valid, null);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('CLIENT_EMAIL_MISSING');
  });

  it('rejects a subtotal that disagrees with Σ(quantity × price)', () => {
    const r = verifyInvoice({ ...valid, subtotalMinor: 999 }, 'b@c.com');
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('SUBTOTAL_MISMATCH');
  });

  it('rejects a total that disagrees with subtotal + tax − discount', () => {
    const r = verifyInvoice({ ...valid, totalMinor: 1200 }, 'b@c.com');
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('TOTAL_MISMATCH');
  });

  it('rejects an invoice where the client has paid more than the total', () => {
    const r = verifyInvoice({ ...valid, amountPaidMinor: 1001 }, 'b@c.com');
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('OVERPAID');
  });

  it('rejects a negative line price', () => {
    const r = verifyInvoice(
      { ...valid, lineItems: [line(1, -500)], subtotalMinor: -500, totalMinor: -500 },
      'b@c.com',
    );
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('LINE_PRICE_INVALID');
  });

  it('rejects a non-ISO currency code', () => {
    const r = verifyInvoice({ ...valid, currency: 'usd' }, 'b@c.com');
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('CURRENCY_INVALID');
  });

  it('rejects an invalid due date', () => {
    const r = verifyInvoice({ ...valid, dueDate: 'not-a-date' }, 'b@c.com');
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('DUE_DATE_INVALID');
  });

  it('returns every issue found, not just the first', () => {
    const r = verifyInvoice(
      { ...valid, currency: 'usd', subtotalMinor: 500, totalMinor: 999, amountPaidMinor: 2000 },
      '',
    );
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'CLIENT_EMAIL_MISSING',
        'CURRENCY_INVALID',
        'SUBTOTAL_MISMATCH',
        'TOTAL_MISMATCH',
        'OVERPAID',
      ]),
    );
  });
});

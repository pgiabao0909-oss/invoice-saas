import { describe, it, expect } from 'vitest';
import { renderInvoicePdf } from '../pdf.js';
import type { Invoice as PrismaInvoice } from '@prisma/client';

function fakeInvoice(): PrismaInvoice {
  return {
    id: 'inv1',
    tenantId: 't1',
    clientId: 'c1',
    invoiceNumber: 'INV-1',
    status: 'draft',
    currency: 'USD',
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2026-01-15T00:00:00Z'),
    lineItems: [{ description: 'Widget', quantity: 2, unitPriceMinor: 1000 }] as any,
    discount: null,
    subtotalMinor: 2000,
    taxMinor: 400,
    discountMinor: 0,
    totalMinor: 2400,
    amountPaidMinor: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  } as PrismaInvoice;
}

describe('renderInvoicePdf (T2)', () => {
  it('produces a valid PDF buffer using tenant branding', async () => {
    const buf = await renderInvoicePdf(fakeInvoice(), 'Acme', {
      primaryColor: '#123456',
      displayName: 'Acme Inc',
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

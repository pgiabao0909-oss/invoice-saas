import PDFDocument from 'pdfkit';
import type { Invoice as PrismaInvoice } from '@prisma/client';
import type { LineItem } from '@invoice-saas/contracts';

export interface TenantBranding {
  displayName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

const money = (minor: number, currency: string): string =>
  `${(minor / 100).toFixed(2)} ${currency}`;

/**
 * Render an invoice to a PDF buffer using pdfkit (pure JS — no headless browser,
 * which keeps workers cheap to scale). Reads tenant branding for the header color
 * and display name. Money is stored as integer minor units, rendered as major
 * units here (2-decimal assumption; per-currency precision is a later refinement).
 */
export function renderInvoicePdf(
  invoice: PrismaInvoice,
  tenantName: string,
  branding: TenantBranding = {},
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accent = branding.primaryColor ?? '#1a1a1a';
    const name = branding.displayName ?? tenantName;

    doc.fontSize(22).fillColor(accent).text(name, { align: 'left' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#555555').text(`Invoice ${invoice.invoiceNumber}`);
    doc.fontSize(9).text(`Issued ${invoice.issueDate.toISOString().slice(0, 10)}`);
    doc.text(`Due ${invoice.dueDate.toISOString().slice(0, 10)}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#000000').text('Line items', { underline: true });
    doc.moveDown(0.25);
    const items = (invoice.lineItems as unknown as LineItem[]) ?? [];
    for (const li of items) {
      doc.fontSize(10).text(
        `${li.description}  × ${li.quantity}  @ ${money(li.unitPriceMinor, invoice.currency)}`,
      );
    }
    doc.moveDown();

    doc.fontSize(11).text(`Subtotal:  ${money(invoice.subtotalMinor, invoice.currency)}`);
    doc.text(`Tax:       ${money(invoice.taxMinor, invoice.currency)}`);
    if (invoice.discountMinor > 0) {
      doc.text(`Discount:  -${money(invoice.discountMinor, invoice.currency)}`);
    }
    doc.moveDown(0.25);
    doc.fontSize(14).fillColor(accent).text(`Total:  ${money(invoice.totalMinor, invoice.currency)}`);

    doc.end();
  });
}

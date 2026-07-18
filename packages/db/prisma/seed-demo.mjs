// Demo data seed for local dev — enriches the base seed with clients, a spread of
// invoices across every status, and recurring subscriptions so the web UI has
// realistic data to render. Idempotent: upserts by natural keys.
// Run with: node prisma/seed-demo.mjs   (from packages/db)
import { PrismaClient } from '@prisma/client';
import { computeTotals } from '@invoice-saas/contracts';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();
const days = (n) => new Date(now + n * DAY);

async function main() {
  const acme = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { name: 'Acme Co', slug: 'acme', dataMode: 'POOLED', baseCurrency: 'USD' },
  });

  // --- Clients -----------------------------------------------------------------
  const clientSpecs = [
    ['bob@acme.test', 'Bob Buyer', 'Acme Retail'],
    ['alice@northwind.test', 'Alice Vendor', 'Northwind Trading'],
    ['carol@globex.test', 'Carol Client', 'Globex Media'],
    ['billing@delta.test', 'Delta Studios', 'Delta Studios LLC'],
    ['ap@wayne.test', 'Wayne Enterprises', 'Wayne Enterprises'],
  ];
  const clients = {};
  for (const [email, legalName, billingAddress] of clientSpecs) {
    clients[email] = await prisma.client.upsert({
      where: { tenantId_email: { tenantId: acme.id, email } },
      update: {},
      create: { tenantId: acme.id, legalName, email, billingAddress },
    });
  }

  // --- Invoices ----------------------------------------------------------------
  // [number, status, currency, clientEmail, dueOffsetDays, amountPaid, lineItems]
  const invoiceSpecs = [
    ['INV-0001', 'draft', 'USD', 'bob@acme.test', 30, 0, [['Website redesign', 2, 150000], ['Hosting (annual)', 1, 2900]]],
    ['INV-0002', 'sent', 'USD', 'alice@northwind.test', 10, 0, [['Consulting — Q3', 1, 240000]]],
    ['INV-0003', 'paid', 'USD', 'carol@globex.test', -20, 180000, [['Brand campaign', 1, 180000]]],
    ['INV-0004', 'overdue', 'USD', 'billing@delta.test', -10, 0, [['Motion graphics', 3, 95000], ['Sound design', 1, 35000]]],
    ['INV-0005', 'void', 'USD', 'ap@wayne.test', 5, 0, [['Archived scope', 1, 50000]]],
    ['INV-0006', 'paid', 'EUR', 'alice@northwind.test', -15, 95000, [['Retainer — design', 1, 95000]]],
    ['INV-0007', 'sent', 'USD', 'bob@acme.test', 14, 0, [['Platform license', 12, 45000]]],
    ['INV-0008', 'paid', 'USD', 'carol@globex.test', -30, 210000, [['Photo shoot', 1, 210000]]],
    ['INV-0009', 'overdue', 'USD', 'billing@delta.test', -4, 0, [['Maintenance', 1, 78000]]],
    ['INV-0010', 'draft', 'USD', 'ap@wayne.test', 21, 0, [['Strategy sprint', 1, 450000]]],
  ];

  for (const [num, status, currency, email, dueOff, paid, items] of invoiceSpecs) {
    const lineItems = items.map(([description, quantity, unitPriceMinor]) => ({
      description,
      quantity,
      unitPriceMinor,
    }));
    const totals = computeTotals(lineItems, [], undefined);
    const issue = days(dueOff - 14);
    await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId: acme.id, invoiceNumber: num } },
      update: {},
      create: {
        tenantId: acme.id,
        clientId: clients[email].id,
        invoiceNumber: num,
        status,
        currency,
        issueDate: issue,
        dueDate: days(dueOff),
        createdAt: issue,
        lineItems,
        subtotalMinor: totals.subtotalMinor,
        taxMinor: totals.taxMinor,
        discountMinor: totals.discountMinor,
        totalMinor: totals.totalMinor,
        amountPaidMinor: paid,
        paymentLink:
          status === 'sent' || status === 'paid'
            ? `https://pay.test/invoice/${num.toLowerCase()}`
            : null,
      },
    });
  }

  // --- Subscriptions -----------------------------------------------------------
  await prisma.subscription.upsert({
    where: { id: 'demo-sub-1' },
    update: {},
    create: {
      id: 'demo-sub-1',
      tenantId: acme.id,
      clientId: clients['alice@northwind.test'].id,
      currency: 'USD',
      lineItems: [{ description: 'Monthly retainer', quantity: 1, unitPriceMinor: 200000 }],
      intervalUnit: 'month',
      intervalCount: 1,
      anchorDate: days(15),
      netDays: 14,
      active: true,
    },
  });
  await prisma.subscription.upsert({
    where: { id: 'demo-sub-2' },
    update: {},
    create: {
      id: 'demo-sub-2',
      tenantId: acme.id,
      clientId: clients['carol@globex.test'].id,
      currency: 'EUR',
      lineItems: [{ description: 'Quarterly support', quantity: 1, unitPriceMinor: 150000 }],
      intervalUnit: 'month',
      intervalCount: 3,
      anchorDate: days(40),
      netDays: 14,
      active: true,
    },
  });

  const count = await prisma.invoice.count({ where: { tenantId: acme.id } });
  console.log(`Demo seed complete. acme invoices: ${count}, subscriptions: 2`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

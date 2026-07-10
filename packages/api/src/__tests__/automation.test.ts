import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * End-to-end test of the new automation endpoints (guide §2.1 trigger + §2.5 trail)
 * using fastify.inject with `@invoice-saas/db` mocked, so no Postgres is needed.
 * Exercises POST /ingest (draft → verify → auto-send) and GET /audit.
 */
const CUID_T = 'ctenant0001aaaaaaaaaaaaaa';
const CUID_C = 'cclient0001aaaaaaaaaaaaaa';
const CUID_I = 'cinvoice001aaaaaaaaaaaaaa';
const ISO = '2026-01-01T00:00:00.000Z';

const invoice = {
  id: CUID_I,
  tenantId: CUID_T,
  clientId: CUID_C,
  invoiceNumber: 'INV-1',
  status: 'sent' as const,
  currency: 'USD',
  issueDate: ISO,
  dueDate: ISO,
  lineItems: [{ description: 'Widget', quantity: 1, unitPriceMinor: 1000 }],
  totals: { subtotalMinor: 1000, taxMinor: 0, discountMinor: 0, totalMinor: 1000 },
  amountPaidMinor: 0,
  createdAt: ISO,
};
const client = { id: CUID_C, tenantId: CUID_T, legalName: 'Acme Co', email: 'billing@acme.test' };
const tenant = {
  id: CUID_T,
  name: 'Demo',
  slug: 'demo',
  dataMode: 'POOLED' as const,
  baseCurrency: 'USD',
  branding: { displayName: 'Demo' },
  createdAt: ISO,
};

vi.mock('@invoice-saas/db', () => ({
  prisma: {},
  createPaymentProvider: () => ({}),
  clientForTenant: () => ({}),
  resolveTenantBySlug: async (slug: string) =>
    slug === 'demo' ? { id: CUID_T, dataMode: 'POOLED', dataLocation: null } : null,
  ingestWork: async () => ({
    invoice,
    clientId: CUID_C,
    verification: { ok: true, issues: [] },
    autoSent: true,
  }),
  getTenant: async () => tenant,
  listAudit: async () => [
    { id: 'ckr3o5v9x0000abcd1234efgi', tenantId: CUID_T, invoiceId: CUID_I, event: 'invoice.sent', createdAt: ISO },
    { id: 'ckr3o5v9x0000abcd1234efgh', tenantId: CUID_T, invoiceId: CUID_I, event: 'invoice.created', createdAt: ISO },
  ],
  recordAudit: async () => {},
  recordPayment: async () => invoice,
  // The rest of the surface the server imports at boot.
  listInvoices: async () => [invoice],
  getInvoiceWithClient: async () => ({ ...invoice, client }),
  createInvoice: async () => invoice,
  markSent: async () => invoice,
  listClients: async () => [client],
  createClient: async () => client,
  listTenants: async () => [tenant],
  createTenant: async () => tenant,
  getStats: async () => ({ draft: 0, sent: 1, paid: 0, overdue: 0, void: 0, outstandingMinor: 1000, totalBilledMinor: 1000 }),
  updateBranding: async () => tenant,
  sweepAllTenants: async () => ({ flipped: 0, remindersEnqueued: 0, flippedIds: [] }),
  AUDIT_EVENTS: { INVOICE_CREATED: 'invoice.created' },
}));

const H = { 'x-tenant-slug': 'demo' };
const goodBody = {
  client: { email: 'billing@acme.test', legalName: 'Acme Co' },
  currency: 'USD',
  dueInDays: 14,
  lineItems: [{ description: 'Consulting', quantity: 1, unitPriceMinor: 5000 }],
};

let app: FastifyInstance;
beforeEach(async () => {
  const { buildServer } = await import('../server.js');
  app = await buildServer();
});
afterEach(async () => {
  await app.close();
  vi.resetModules();
});

describe('automation endpoints', () => {
  it('POST /ingest requires x-tenant-slug (401) and drafts+auto-sends when present', async () => {
    const noTenant = await app.inject({ method: 'POST', url: '/ingest', payload: goodBody });
    expect(noTenant.statusCode).toBe(401);

    const res = await app.inject({ method: 'POST', url: '/ingest', headers: H, payload: goodBody });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.invoice.invoiceNumber).toBe('INV-1');
    expect(body.verification.ok).toBe(true);
    expect(body.autoSent).toBe(true); // no human click needed
    expect(body.clientId).toBe(CUID_C);
  });

  it('GET /audit returns the tenant trail most-recent-first', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit', headers: H });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
    expect(body[0].event).toBe('invoice.sent');
    expect(body[1].event).toBe('invoice.created');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * Exercises the UI read/write routes (GET /invoices, /invoices/:id, /clients,
 * /tenants, /me, PATCH /me/branding) end-to-end with fastify.inject, mocking
 * `@invoice-saas/db` so no Postgres is needed. Response bodies flow through the real
 * Zod serializer, so this also proves the wire shapes satisfy the shared contracts.
 */

const CUID_T = 'ctenant0001aaaaaaaaaaaaaa';
const CUID_C = 'cclient0001aaaaaaaaaaaaaa';
const CUID_I = 'cinvoice001aaaaaaaaaaaaaa';
const ISO = '2026-01-01T00:00:00.000Z';

const client = {
  id: CUID_C,
  tenantId: CUID_T,
  legalName: 'Acme Co',
  email: 'billing@acme.test',
  billingAddress: '1 Way',
  taxIdentifier: 'VAT-1',
  createdAt: ISO,
};
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
const tenant = {
  id: CUID_T,
  name: 'Demo',
  slug: 'demo',
  dataMode: 'POOLED' as const,
  baseCurrency: 'USD',
  branding: { displayName: 'Demo', primaryColor: '#4F46E5' },
  createdAt: ISO,
};
const stats = {
  draft: 0,
  sent: 1,
  paid: 0,
  overdue: 0,
  void: 0,
  outstandingMinor: 1000,
  totalBilledMinor: 1000,
};

vi.mock('@invoice-saas/db', () => {
  return {
    prisma: {},
    createPaymentProvider: () => ({}),
    clientForTenant: () => ({}),
    // resolveTenant plugin calls this; return a route for slug "demo", else null.
    resolveTenantBySlug: async (slug: string) =>
      slug === 'demo' ? { id: CUID_T, dataMode: 'POOLED', dataLocation: null } : null,
    listInvoices: async () => [invoice],
    getInvoiceWithClient: async (_db: unknown, _t: string, id: string) =>
      id === CUID_I ? { ...invoice, client } : null,
    createInvoice: async () => invoice,
    markSent: async () => invoice,
    listClients: async () => [client],
    createClient: async () => client,
    listTenants: async () => [tenant],
    createTenant: async () => tenant,
    getTenant: async () => tenant,
    getStats: async () => stats,
    updateBranding: async () => ({ ...tenant, branding: { displayName: 'Renamed' } }),
    // Automation surfaces added in the automation build.
    ingestWork: async () => ({
      invoice,
      clientId: CUID_C,
      verification: { ok: true, issues: [] },
      autoSent: true,
    }),
    listAudit: async () => [],
    recordAudit: async () => {},
    recordPayment: async () => invoice,
    sweepAllTenants: async () => ({ flipped: 0, remindersEnqueued: 0, flippedIds: [] }),
    AUDIT_EVENTS: { INVOICE_CREATED: 'invoice.created' },
  };
});

let app: FastifyInstance;
beforeEach(async () => {
  const { buildServer } = await import('../server.js');
  app = await buildServer();
});
afterEach(async () => {
  await app.close();
  vi.resetModules();
});

const H = { 'x-tenant-slug': 'demo' };

describe('UI read/write routes', () => {
  it('GET /invoices requires x-tenant-slug (401) and returns list when present', async () => {
    const noTenant = await app.inject({ method: 'GET', url: '/invoices' });
    expect(noTenant.statusCode).toBe(401);

    const res = await app.inject({ method: 'GET', url: '/invoices', headers: H });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].invoiceNumber).toBe('INV-1');
  });

  it('GET /invoices/:id returns detail with client, 404 when missing', async () => {
    const ok = await app.inject({ method: 'GET', url: `/invoices/${CUID_I}`, headers: H });
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body).client.legalName).toBe('Acme Co');

    const missing = await app.inject({
      method: 'GET',
      url: `/invoices/cmissing001aaaaaaaaaaaaaa`,
      headers: H,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('GET /clients returns the tenant clients', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: H });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)[0].email).toBe('billing@acme.test');
  });

  it('GET /tenants lists workspaces without a tenant header', async () => {
    const res = await app.inject({ method: 'GET', url: '/tenants' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)[0].slug).toBe('demo');
  });

  it('GET /me returns tenant + stats', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: H });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tenant.slug).toBe('demo');
    expect(body.stats.sent).toBe(1);
  });

  it('PATCH /me/branding updates branding', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/branding',
      headers: H,
      payload: { displayName: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).branding.displayName).toBe('Renamed');
  });

  it('rejects an unknown tenant slug (404)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/invoices',
      headers: { 'x-tenant-slug': 'nope' },
    });
    expect(res.statusCode).toBe(404);
  });
});

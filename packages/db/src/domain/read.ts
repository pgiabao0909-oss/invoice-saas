import type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type {
  BrandingUpdate,
  Client,
  ClientCreate,
  DashboardStats,
  Invoice,
  InvoiceListQuery,
  InvoiceStatus,
  InvoiceWithClient,
  Tenant,
  TenantCreate,
  TenantId,
} from '@invoice-saas/contracts';
import { mapInvoice } from './invoices.js';

const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

function mapClient(r: {
  id: string;
  tenantId: string;
  legalName: string;
  email: string;
  billingAddress: string | null;
  taxIdentifier: string | null;
  createdAt: Date;
}): Client {
  return {
    id: r.id,
    tenantId: r.tenantId,
    legalName: r.legalName,
    email: r.email,
    billingAddress: r.billingAddress ?? undefined,
    taxIdentifier: r.taxIdentifier ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

function mapTenant(r: {
  id: string;
  name: string;
  slug: string;
  dataMode: 'POOLED' | 'SILOED';
  dataLocation: string | null;
  baseCurrency: string;
  branding: unknown;
  createdAt: Date;
}): Tenant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    dataMode: r.dataMode,
    dataLocation: r.dataLocation ?? undefined,
    baseCurrency: r.baseCurrency,
    branding: (r.branding as Tenant['branding']) ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

// --- Invoices --------------------------------------------------------------

export async function listInvoices(
  prisma: PrismaClient,
  tenantId: TenantId,
  query: InvoiceListQuery = {},
): Promise<Invoice[]> {
  const where: Prisma.InvoiceWhereInput = { tenantId };
  if (query.status) where.status = query.status;
  if (query.clientId) where.clientId = query.clientId;

  const rows = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => mapInvoice(r));
}

export async function getInvoiceWithClient(
  prisma: PrismaClient,
  tenantId: TenantId,
  invoiceId: string,
): Promise<InvoiceWithClient | null> {
  const row = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { client: true },
  });
  if (!row) return null;
  const { client, ...invoiceRow } = row;
  return { ...mapInvoice(invoiceRow), client: mapClient(client) };
}

// --- Clients ---------------------------------------------------------------

export async function listClients(
  prisma: PrismaClient,
  tenantId: TenantId,
): Promise<Client[]> {
  const rows = await prisma.client.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapClient);
}

export async function createClient(
  prisma: PrismaClient,
  tenantId: TenantId,
  input: ClientCreate,
): Promise<Client> {
  const created = await prisma.client.create({
    data: {
      tenantId,
      legalName: input.legalName,
      email: input.email,
      billingAddress: input.billingAddress ?? null,
      taxIdentifier: input.taxIdentifier ?? null,
    },
  });
  return mapClient(created);
}

// --- Tenants ---------------------------------------------------------------

export async function listTenants(prisma: PrismaClient): Promise<Tenant[]> {
  const rows = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(mapTenant);
}

export async function createTenant(
  prisma: PrismaClient,
  input: TenantCreate,
): Promise<Tenant> {
  const created = await prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      dataMode: input.dataMode,
      dataLocation: input.dataLocation ?? null,
      baseCurrency: input.baseCurrency,
      branding: input.branding ? toJson(input.branding) : undefined,
    },
  });
  return mapTenant(created);
}

export async function getTenant(
  prisma: PrismaClient,
  tenantId: TenantId,
): Promise<Tenant | null> {
  const row = await prisma.tenant.findUnique({ where: { id: tenantId } });
  return row ? mapTenant(row) : null;
}

export async function updateBranding(
  prisma: PrismaClient,
  tenantId: TenantId,
  branding: BrandingUpdate,
): Promise<Tenant> {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { branding: toJson(branding) },
  });
  return mapTenant(updated);
}

// --- Dashboard stats -------------------------------------------------------

export async function getStats(
  prisma: PrismaClient,
  tenantId: TenantId,
): Promise<DashboardStats> {
  const rows = await prisma.invoice.findMany({
    where: { tenantId },
    select: { status: true, totalMinor: true, amountPaidMinor: true },
  });

  const counts: Record<InvoiceStatus, number> = {
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    void: 0,
  };
  let outstandingMinor = 0;
  let totalBilledMinor = 0;

  for (const inv of rows) {
    counts[inv.status] += 1;
    totalBilledMinor += inv.totalMinor;
    if (inv.status !== 'paid' && inv.status !== 'void') {
      outstandingMinor += Math.max(0, inv.totalMinor - inv.amountPaidMinor);
    }
  }

  return {
    draft: counts.draft,
    sent: counts.sent,
    paid: counts.paid,
    overdue: counts.overdue,
    void: counts.void,
    outstandingMinor,
    totalBilledMinor,
  };
}

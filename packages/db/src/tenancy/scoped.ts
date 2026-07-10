import type { PrismaClient } from '@prisma/client';
import type { ClientId, InvoiceId, TenantId } from '@invoice-saas/contracts';

/**
 * The PRIMARY multi-tenant guard (ADR 0001). Every repository method on this
 * class threads `tenantId` into its `where` clause, so a caller literally cannot
 * read or write another tenant's rows through it. Row-Level Security (rls.sql) is
 * a defense-in-depth backstop for the pooled database; this is the guarantee that
 * holds regardless of DB support.
 *
 * This is the behavior asserted by the T0 isolation test.
 */
export const tenantWhere = (tenantId: TenantId) => ({ tenantId } as const);

export class TenantScoped {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: TenantId,
  ) {}

  // --- Invoices ---------------------------------------------------------
  listInvoices() {
    return this.prisma.invoice.findMany({ where: { tenantId: this.tenantId } });
  }

  getInvoice(id: InvoiceId) {
    return this.prisma.invoice.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  // --- Clients ----------------------------------------------------------
  listClients() {
    return this.prisma.client.findMany({ where: { tenantId: this.tenantId } });
  }

  getClient(id: ClientId) {
    return this.prisma.client.findFirst({ where: { id, tenantId: this.tenantId } });
  }
}

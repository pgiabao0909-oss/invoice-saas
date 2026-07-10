import type { PrismaClient } from '@prisma/client';
import { prisma } from '../prisma.js';
import type { TenantDataMode, TenantId } from '@invoice-saas/contracts';

/**
 * A resolved tenant: tells the data layer WHERE this tenant's data lives.
 * This is the routing decision at the heart of hybrid tenancy (ADR 0001).
 */
export interface TenantRoute {
  id: TenantId;
  dataMode: TenantDataMode;
  /** For SILOED tenants: the dedicated DB/schema location (null when pooled). */
  dataLocation: string | null;
}

export async function resolveTenantBySlug(slug: string): Promise<TenantRoute | null> {
  const t = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, dataMode: true, dataLocation: true },
  });
  return t;
}

/**
 * Returns the Prisma client for a tenant's data.
 *
 * - POOLED → the shared `prisma` client. RLS (src/rls.sql) keeps rows apart.
 * - SILOED → a dedicated client for `route.dataLocation`. (Provisioning of that
 *   database is a later ticket; here we branch so the seam is explicit.)
 */
export function clientForTenant(route: TenantRoute): PrismaClient {
  if (route.dataMode === 'SILOED' && route.dataLocation) {
    // TODO(ticket: siloed-provisioning): cache one client per dataLocation.
    // For now pooled and siloed share the singleton to keep the foundation runnable.
    return prisma;
  }
  return prisma;
}

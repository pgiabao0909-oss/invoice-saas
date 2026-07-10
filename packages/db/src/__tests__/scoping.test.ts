import { describe, it, expect } from 'vitest';
import { TenantScoped, tenantWhere } from '../tenancy/scoped.js';
import type { TenantId } from '@invoice-saas/contracts';

/** Minimal fake of just the Prisma surface the scoped repos touch. */
function fakePrisma() {
  const calls: Array<{ where: Record<string, unknown> }> = [];
  const prisma: any = {
    invoice: {
      findMany: (args: any) => {
        calls.push(args);
        return Promise.resolve([]);
      },
      findFirst: (args: any) => {
        calls.push(args);
        return Promise.resolve(null);
      },
    },
    client: {
      findMany: (args: any) => {
        calls.push(args);
        return Promise.resolve([]);
      },
      findFirst: (args: any) => {
        calls.push(args);
        return Promise.resolve(null);
      },
    },
  };
  return { prisma, calls };
}

describe('T0 — multi-tenant data isolation', () => {
  const tenantA = 'ckp1tenantAxxxxxxxxx' as TenantId;
  const tenantB = 'ckp1tenantByyyyyyyyyy' as TenantId;

  it('tenantWhere always carries tenantId', () => {
    expect(tenantWhere(tenantA)).toEqual({ tenantId: tenantA });
  });

  it('listInvoices scopes every read to the tenant', async () => {
    const { prisma, calls } = fakePrisma();
    await new TenantScoped(prisma, tenantA).listInvoices();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.where.tenantId).toBe(tenantA);
  });

  it('getInvoice cannot fetch another tenant’s invoice', async () => {
    const { prisma, calls } = fakePrisma();
    await new TenantScoped(prisma, tenantB).getInvoice('some-invoice-id' as any);
    expect(calls).toHaveLength(1);
    // The where clause binds BOTH the id and tenantId — an id alone would be a leak.
    expect(calls[0]!.where).toMatchObject({
      id: 'some-invoice-id',
      tenantId: tenantB,
    });
  });

  it('listClients + getClient are tenant-scoped', async () => {
    const { prisma, calls } = fakePrisma();
    const scoped = new TenantScoped(prisma, tenantA);
    await scoped.listClients();
    await scoped.getClient('some-client-id' as any);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.where.tenantId).toBe(tenantA);
    }
  });

  it('tenant A’s query is structurally isolated from tenant B’s', async () => {
    const a = fakePrisma();
    const b = fakePrisma();
    await new TenantScoped(a.prisma, tenantA).listInvoices();
    await new TenantScoped(b.prisma, tenantB).listInvoices();
    expect(a.calls[0]!.where.tenantId).not.toBe(b.calls[0]!.where.tenantId);
  });
});

import { describe, it, expect } from 'vitest';
import { recordAudit, listAudit } from '../domain/audit.js';
import type { TenantId } from '@invoice-saas/contracts';

/**
 * Proves the immutable audit trail (guide §2.5) is append-only and queryable:
 * records persist, are tenant-scoped, and can be filtered by invoice + ordered
 * most-recent-first. No database required — a minimal in-memory prisma stands in.
 */
function makeFakePrisma() {
  const rows: Array<any> = [];
  let seq = 0;
  const prisma: any = {
    auditLog: {
      create: async (a: { data: any }) => {
        const r = { id: `a${++seq}`, createdAt: new Date(), ...a.data };
        rows.push(r);
        return r;
      },
      findMany: async (args: { where: any; orderBy: any; take: number }) => {
        let out = rows.filter((r) => {
          if (args.where.tenantId && r.tenantId !== args.where.tenantId) return false;
          if (args.where.invoiceId && r.invoiceId !== args.where.invoiceId) return false;
          return true;
        });
        if (args.orderBy?.createdAt === 'desc') out = out.slice().reverse();
        return out.slice(0, args.take);
      },
    },
  };
  return { prisma, rows };
}

describe('audit — immutable trail', () => {
  it('appends records and lists them most-recent-first, tenant-scoped', async () => {
    const { prisma, rows } = makeFakePrisma();
    await recordAudit(prisma, { tenantId: 't1' as TenantId, invoiceId: 'i1', event: 'invoice.created' });
    await recordAudit(prisma, { tenantId: 't1' as TenantId, invoiceId: 'i1', event: 'invoice.sent' });
    await recordAudit(prisma, { tenantId: 't2' as TenantId, invoiceId: 'i2', event: 'invoice.created' });

    const list = await listAudit(prisma, 't1' as TenantId, {});
    expect(list).toHaveLength(2);
    expect(list[0]!.event).toBe('invoice.sent'); // newest first
    expect(list[1]!.event).toBe('invoice.created');

    // Tenant isolation: tenant t2 never sees t1's records.
    const t2 = await listAudit(prisma, 't2' as TenantId, {});
    expect(t2).toHaveLength(1);
    expect(t2[0]!.tenantId).toBe('t2');
  });

  it('filters by invoiceId', async () => {
    const { prisma } = makeFakePrisma();
    await recordAudit(prisma, { tenantId: 't1' as TenantId, invoiceId: 'i1', event: 'invoice.created' });
    await recordAudit(prisma, { tenantId: 't1' as TenantId, invoiceId: 'i2', event: 'invoice.created' });
    const list = await listAudit(prisma, 't1' as TenantId, { invoiceId: 'i1' });
    expect(list).toHaveLength(1);
    expect(list[0]!.invoiceId).toBe('i1');
  });
});

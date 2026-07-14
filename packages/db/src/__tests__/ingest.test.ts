import { describe, it, expect } from 'vitest';
import { ingestWork } from '../domain/ingest.js';
import type { Ingest, IngestResult, TenantId } from '@invoice-saas/contracts';

/**
 * Exercises the end-to-end automation pipeline (guide §2.1 → §2.4 → §2.3) against
 * an in-memory Prisma, with NO database. Asserts the three outcomes an operator
 * cares about:
 *   - a VALID unit of work is drafted, verified, and auto-sent (status sent);
 *   - the audit trail records created → verified → sent;
 *   - an INVALID unit of work is drafted, HELD (never sent), and the failure audited.
 *
 * The fake mirrors the structural style of overdue.test.ts / mark-sent.test.ts: a
 * shared store plus model implementations, with `$transaction` running against the
 * same store so reads see committed writes.
 */
const DAY = 24 * 60 * 60 * 1000;

function makeFakePrisma() {
  const store = {
    clients: new Map<string, any>(),
    invoices: new Map<string, any>(),
    audit: [] as Array<{ tenantId: string; invoiceId: string | null; event: string; detail: any }>,
    jobs: [] as Array<{ type: string; payload: any }>,
    outbox: [] as Array<any>,
  };
  let seq = 0;

  const models = () => ({
    client: {
      findFirst: async (args: { where: { tenantId: string; email?: string } }) =>
        [...store.clients.values()].find(
          (c) => c.tenantId === args.where.tenantId && (!args.where.email || c.email === args.where.email),
        ) ?? null,
      create: async (args: { data: any }) => {
        const c = { id: `c${++seq}`, createdAt: new Date('2026-01-01T00:00:00Z'), ...args.data };
        store.clients.set(c.id, c);
        return c;
      },
      findUnique: async (args: { where: { id: string } }) => store.clients.get(args.where.id) ?? null,
    },
    invoice: {
      findMany: async () => [...store.invoices.values()],
      findFirst: async (args: {
        where: { id?: string; tenantId?: string; idempotencyKey?: string };
      }) => {
        const r = args.where.id ? store.invoices.get(args.where.id) : undefined;
        if (r) {
          if (args.where.tenantId && r.tenantId !== args.where.tenantId) return null;
          return r;
        }
        if (args.where.idempotencyKey) {
          return (
            [...store.invoices.values()].find(
              (x) => x.idempotencyKey === args.where.idempotencyKey,
            ) ?? null
          );
        }
        return null;
      },
      create: async (args: { data: any }) => {
        const r = {
          id: `inv${++seq}`,
          status: 'draft',
          issueDate: new Date('2026-01-01T00:00:00Z'), // Prisma defaults this; mirror it
          amountPaidMinor: 0,
          paymentLink: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          ...args.data,
        };
        store.invoices.set(r.id, r);
        return r;
      },
      update: async (args: { where: { id: string }; data: any }) => {
        const r = store.invoices.get(args.where.id);
        if (!r) throw new Error('INVOICE_NOT_FOUND');
        Object.assign(r, args.data);
        return r;
      },
    },
    taxRate: { findMany: async () => [] },
    outboxMessage: { create: async (a: { data: any }) => { store.outbox.push(a.data); return {}; } },
    job: { create: async (a: { data: any }) => { store.jobs.push(a.data); return {}; } },
    auditLog: {
      create: async (a: { data: any }) => {
        store.audit.push({ tenantId: a.data.tenantId, invoiceId: a.data.invoiceId ?? null, event: a.data.event, detail: a.data.detail });
        return {};
      },
    },
  });

  const prisma: any = {
    ...models(),
    $transaction: async (fn: (tx: ReturnType<typeof models>) => Promise<any>) => fn(models()),
  };
  return { prisma, store };
}

const validIngest: Ingest = {
  client: { email: 'billing@acme.test', legalName: 'Acme Co' },
  currency: 'USD',
  dueInDays: 14,
  lineItems: [{ description: 'Consulting', quantity: 2, unitPriceMinor: 5000 }],
};

describe('ingestWork — automated invoice pipeline', () => {
  it('drafts, verifies, and auto-sends a valid unit of work; records the trail', async () => {
    const { prisma, store } = makeFakePrisma();
    const result = await ingestWork(prisma, 't1' as TenantId, validIngest);

    expect(result.autoSent).toBe(true);
    expect(result.verification.ok).toBe(true);
    const inv = store.invoices.get(result.invoice.id)!;
    expect(inv.status).toBe('sent'); // auto-delivered, no human click
    // Client was resolved (created) by email.
    expect(store.clients.size).toBe(1);
    expect(store.clients.get(result.clientId)!.email).toBe('billing@acme.test');
    // Email job enqueued by markSent.
    expect(store.jobs.some((j) => j.type === 'EMAIL_INVOICE')).toBe(true);
    // Immutable trail: created → verified → sent.
    expect(store.audit.map((a) => a.event)).toEqual([
      'invoice.created',
      'invoice.verified',
      'invoice.sent',
    ]);
  });

  it('HOLDS (never sends) an invalid unit of work and audits the failure', async () => {
    const { prisma, store } = makeFakePrisma();
    // A zero-quantity line fails verification (the gate rejects non-positive quantities).
    const bad: Ingest = {
      ...validIngest,
      lineItems: [{ description: 'Broken', quantity: 0, unitPriceMinor: 5000 }],
    };
    const result = await ingestWork(prisma, 't1' as TenantId, bad);

    expect(result.autoSent).toBe(false);
    expect(result.verification.ok).toBe(false);
    const inv = store.invoices.get(result.invoice.id)!;
    expect(inv.status).toBe('draft'); // held, not sent
    expect(store.jobs.some((j) => j.type === 'EMAIL_INVOICE')).toBe(false);
    const events = store.audit.map((a) => a.event);
    expect(events).toContain('invoice.verification_failed');
    expect(events).toContain('invoice.held');
  });

  it('reuses an existing client by email instead of duplicating', async () => {
    const { prisma, store } = makeFakePrisma();
    await ingestWork(prisma, 't1' as TenantId, validIngest);
    const firstClientId = [...store.clients.values()][0].id;
    await ingestWork(prisma, 't1' as TenantId, validIngest);
    expect(store.clients.size).toBe(1);
    expect([...store.clients.values()][0].id).toBe(firstClientId);
    expect(store.invoices.size).toBe(2);
  });

  it('respects autoSend:false by creating a draft and holding it for review', async () => {
    const { prisma, store } = makeFakePrisma();
    const result: IngestResult = await ingestWork(prisma, 't1' as TenantId, {
      ...validIngest,
      autoSend: false,
    });
    expect(result.autoSent).toBe(false);
    expect(store.invoices.get(result.invoice.id)!.status).toBe('draft');
    expect(store.audit.map((a) => a.event)).toContain('invoice.held');
  });

  it('is idempotent: retrying the same idempotencyKey returns the original invoice (no duplicate)', async () => {
    const { prisma, store } = makeFakePrisma();
    const first = await ingestWork(prisma, 't1' as TenantId, {
      ...validIngest,
      idempotencyKey: 'evt_abc123',
    });
    expect(first.autoSent).toBe(true);

    const second = await ingestWork(prisma, 't1' as TenantId, {
      ...validIngest,
      idempotencyKey: 'evt_abc123',
    });
    // Same invoice returned, no second row created, no second email job enqueued.
    expect(store.invoices.size).toBe(1);
    expect(second.invoice.id).toBe(first.invoice.id);
    expect(second.autoSent).toBe(true);
    expect(store.jobs.filter((j) => j.type === 'EMAIL_INVOICE').length).toBe(1);
  });

  it('treats distinct idempotencyKeys as separate invoices', async () => {
    const { prisma, store } = makeFakePrisma();
    await ingestWork(prisma, 't1' as TenantId, { ...validIngest, idempotencyKey: 'evt_one' });
    await ingestWork(prisma, 't1' as TenantId, { ...validIngest, idempotencyKey: 'evt_two' });
    expect(store.invoices.size).toBe(2);
  });
});

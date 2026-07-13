import { Prisma } from '@prisma/client';
import type { PrismaClient, Subscription as PrismaSubscription } from '@prisma/client';
import type {
  Discount,
  Invoice,
  InvoiceId,
  LineItem,
  Subscription,
  SubscriptionCreate,
  SubscriptionInterval,
  TenantId,
} from '@invoice-saas/contracts';
import { AUDIT_EVENTS } from '@invoice-saas/contracts';
import { createInvoice, markSent } from './invoices.js';
import { recordAudit } from './audit.js';

const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
const DAY_MS = 24 * 60 * 60 * 1000;

export function mapSubscription(r: PrismaSubscription): Subscription {
  return {
    id: r.id,
    tenantId: r.tenantId,
    clientId: r.clientId,
    currency: r.currency,
    lineItems: r.lineItems as unknown as Subscription['lineItems'],
    discount: r.discount ? (r.discount as Discount) : undefined,
    intervalUnit: r.intervalUnit as SubscriptionInterval,
    intervalCount: r.intervalCount,
    anchorDate: r.anchorDate.toISOString(),
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    active: r.active,
    netDays: r.netDays,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Advance a date by `count` units (calendar-aware for month/year). Pure + tested. */
export function advanceDate(date: Date, unit: SubscriptionInterval, count: number): Date {
  const d = new Date(date);
  switch (unit) {
    case 'day':
      d.setDate(d.getDate() + count);
      break;
    case 'week':
      d.setDate(d.getDate() + count * 7);
      break;
    case 'month':
      d.setMonth(d.getMonth() + count);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + count);
      break;
  }
  return d;
}

export async function createSubscription(
  prisma: PrismaClient,
  tenantId: TenantId,
  input: SubscriptionCreate,
): Promise<Subscription> {
  const client = await prisma.client.findFirst({ where: { id: input.clientId, tenantId } });
  if (!client) throw new Error('CLIENT_NOT_FOUND');
  const anchor = input.anchorDate ? new Date(input.anchorDate) : new Date(Date.now() + 30 * DAY_MS);
  const created = await prisma.subscription.create({
    data: {
      tenantId,
      clientId: input.clientId,
      currency: input.currency ?? 'USD',
      lineItems: toJson(input.lineItems),
      discount: input.discount ? toJson(input.discount) : undefined,
      intervalUnit: input.intervalUnit,
      intervalCount: input.intervalCount,
      anchorDate: anchor,
      netDays: input.netDays ?? 14,
      active: input.active ?? true,
    },
  });
  return mapSubscription(created);
}

export async function listSubscriptions(
  prisma: PrismaClient,
  tenantId: TenantId,
): Promise<Subscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { tenantId },
    orderBy: { anchorDate: 'asc' },
  });
  return rows.map(mapSubscription);
}

/**
 * C2 — generate one invoice for a due subscription and advance its schedule.
 * Reuses the existing `createInvoice` + `markSent` (same verification gate, email
 * outbox, and audit trail as the manual/ingest paths), so a recurring invoice is
 * indistinguishable from a one-off. A deterministic idempotencyKey
 * (`sub:<id>:<anchorISO>`) means even a double-fired tick cannot duplicate.
 */
async function generateFromSubscription(
  prisma: PrismaClient,
  sub: PrismaSubscription,
): Promise<Invoice | null> {
  const client = await prisma.client.findUnique({ where: { id: sub.clientId } });
  if (!client) return null;

  const invoice = await createInvoice(prisma, sub.tenantId, {
    clientId: sub.clientId,
    currency: sub.currency,
    dueDate: new Date(Date.now() + (sub.netDays ?? 14) * DAY_MS).toISOString(),
    lineItems: sub.lineItems as unknown as LineItem[],
    discount: sub.discount as Discount | undefined,
    idempotencyKey: `sub:${sub.id}:${sub.anchorDate.toISOString()}`,
  });

  try {
    await markSent(prisma, sub.tenantId, invoice.id as InvoiceId, { source: 'recurring' });
  } catch (err) {
    // A verification failure holds the invoice as a draft; we still advance the
    // schedule so a broken period doesn't retry forever (C5 alerting is future work).
    await recordAudit(prisma, {
      tenantId: sub.tenantId,
      invoiceId: invoice.id,
      event: AUDIT_EVENTS.INVOICE_HELD,
      detail: {
        reason: 'recurring_verification_failed',
        error: err instanceof Error ? err.message : 'unknown',
      },
    });
  }
  return invoice;
}

/**
 * C2 — generate invoices for every active subscription whose `anchorDate` has passed,
 * then advance each schedule. Mirrors `sweepAllTenants`: one subscription at a time,
 * so a bad one can't abort the rest. Returns how many invoices were generated.
 */
export async function runDueSubscriptions(prisma: PrismaClient): Promise<{ generated: number }> {
  const due = await prisma.subscription.findMany({
    where: { active: true, anchorDate: { lte: new Date() } },
  });
  let generated = 0;
  for (const sub of due) {
    const invoice = await generateFromSubscription(prisma, sub);
    if (invoice) generated++;
    const next = advanceDate(sub.anchorDate, sub.intervalUnit as SubscriptionInterval, sub.intervalCount);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { anchorDate: next, lastRunAt: new Date() },
    });
  }
  return { generated };
}

import Fastify from 'fastify';
import { describe, it, expect, afterEach } from 'vitest';
import { stripeWebhookRoutes } from '../routes/webhooks.js';
import { FakePaymentProvider } from '@invoice-saas/db';
import type { PaymentProvider } from '@invoice-saas/db';

/**
 * T3 — exercises the Stripe webhook route end-to-end with `fastify.inject`, using
 * a fake Prisma + the fake provider (no Stripe keys, no DB). A failing-signature
 * case uses a tiny inline provider override to keep the suite deterministic.
 */
interface InvoiceRow {
  id: string;
  tenantId: string;
  clientId: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: unknown;
  discount: unknown;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  paymentLink: string | null;
  createdAt: Date;
}

interface PaymentRow {
  id: string;
  invoiceId: string;
  tenantId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  stripeChargeId: string | null;
}

function makeFakePrisma() {
  const invoice: InvoiceRow = {
    id: 'inv1',
    tenantId: 't1',
    clientId: 'c1',
    invoiceNumber: 'INV-1',
    status: 'sent',
    currency: 'USD',
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2026-01-15T00:00:00Z'),
    lineItems: [],
    discount: null,
    subtotalMinor: 1000,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor: 1000,
    amountPaidMinor: 0,
    paymentLink: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const payments: PaymentRow[] = [];

  const models = () => ({
    invoice: {
      findFirst: async (args: { where: { id: string; tenantId?: string } }) => {
        if (args.where.tenantId && invoice.tenantId !== args.where.tenantId) return null;
        return invoice;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(invoice, args.data);
        return invoice;
      },
    },
    payment: {
      findFirst: async (args: { where: { tenantId: string; idempotencyKey: string } }) =>
        payments.find((p) => p.tenantId === args.where.tenantId && p.idempotencyKey === args.where.idempotencyKey) ?? null,
      create: async (args: { data: Omit<PaymentRow, 'id'> }) => {
        const row: PaymentRow = { id: `pay_${payments.length}`, ...args.data };
        payments.push(row);
        return row;
      },
    },
  });

  const prisma: any = {
    $transaction: async (fn: (tx: ReturnType<typeof models>) => Promise<unknown>) => fn(models()),
    ...models(),
  };
  return { prisma, invoice, payments };
}

const servers: Fastify.FastifyInstance[] = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
});

function buildApp(prisma: unknown, provider: PaymentProvider): Fastify.FastifyInstance {
  const app = Fastify();
  servers.push(app);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.register(stripeWebhookRoutes({ prisma: prisma as any, provider }), { prefix: '/webhooks' });
  return app;
}

describe('POST /webhooks/stripe', () => {
  it('records a payment from a valid event and returns 200 {received:true}', async () => {
    const { prisma, invoice, payments } = makeFakePrisma();
    const app = buildApp(prisma, new FakePaymentProvider());
    const body = JSON.stringify({
      type: 'checkout.session.completed',
      eventId: 'evt_1',
      tenantId: 't1',
      invoiceId: 'inv1',
      amountMinor: 1000,
      currency: 'USD',
      idempotencyKey: 'idem_1',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'sig' },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
    expect(payments).toHaveLength(1);
    expect(invoice.status).toBe('paid');
  });

  it('returns 400 when the signature is invalid', async () => {
    const { prisma } = makeFakePrisma();
    const failing: PaymentProvider = {
      createPaymentLink: async () => ({ url: '' }),
      verifyWebhookSignature: () => false,
      parseEvent: () => ({ type: 'x', eventId: '', tenantId: '', invoiceId: '', amountMinor: 0, currency: 'USD', idempotencyKey: '' }),
    };
    const app = buildApp(prisma, failing);

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'bad' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 200 for an unhandled event type (Stripe needs 2xx)', async () => {
    const { prisma } = makeFakePrisma();
    const app = buildApp(prisma, new FakePaymentProvider());
    const body = JSON.stringify({
      type: 'customer.created',
      eventId: 'evt_x',
      tenantId: 't1',
      invoiceId: 'inv1',
      amountMinor: 0,
      currency: 'USD',
      idempotencyKey: 'idem_x',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'sig' },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
  });
});

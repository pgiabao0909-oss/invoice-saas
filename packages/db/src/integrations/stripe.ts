import crypto from 'node:crypto';

/**
 * T3 — Payment provider seam (mirrors the EmailSender seam in packages/worker).
 *
 * The domain and the worker depend ONLY on `PaymentProvider`, never on Stripe
 * directly, so tests can run without any Stripe credentials. `createPaymentProvider`
 * returns a `FakePaymentProvider` when the real keys are absent (same fallback
 * strategy as `createEmailSender`), and the real `StripePaymentProvider` (pure
 * `fetch`, no SDK) when keys are set.
 */

export interface CreatePaymentLinkInput {
  invoiceId: string;
  tenantId: string;
  amountMinor: number;
  currency: string;
  description: string;
}

/** Parsed, normalized shape the webhook handler operates on. */
export interface ParsedStripeEvent {
  type: string;
  eventId: string;
  tenantId: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

/** A completed payment surfaced for reconciliation (guide §C4). */
export interface ReconcilePayment {
  eventId: string;
  tenantId: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentProvider {
  /** Creates a hosted payment link for an invoice; returns its URL. */
  createPaymentLink(input: CreatePaymentLinkInput): Promise<{ url: string }>;
  /** Verifies the `Stripe-Signature` HMAC for a raw webhook body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  /** Parses a raw webhook body into the normalized event shape. */
  parseEvent(rawBody: string): ParsedStripeEvent;
  /**
   * Lists recently-completed payments for reconciliation (guide §C4). The live
   * provider queries Stripe (Payment Intents with metadata); the fake returns [].
   * The scheduler replays these through `recordPayment`, which is idempotent, so a
   * charge already captured by a webhook is a safe no-op and a MISSED webhook is
   * applied — closing the loop when Stripe fails to deliver an event.
   */
  listCompletedCharges(opts: { createdAfter?: number }): Promise<ReconcilePayment[]>;
}

/**
 * Real provider — talks to Stripe over `fetch` (no SDK dependency).
 * Reads STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET from the environment.
 */
export class StripePaymentProvider implements PaymentProvider {
  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<{ url: string }> {
    const res = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price_data][currency]': input.currency.toLowerCase(),
        'line_items[0][price_data][product_data][name]': input.description,
        'line_items[0][price_data][unit_amount]': String(input.amountMinor),
        'line_items[0][quantity]': '1',
        // invoice id travels in metadata so the webhook can route back to it. The
        // idempotencyKey (== invoice id) is shared by the webhook and reconciliation
        // so a replayed payment is a safe no-op (guide §C4).
        'metadata[invoiceId]': input.invoiceId,
        'metadata[tenantId]': input.tenantId,
        'metadata[idempotencyKey]': input.invoiceId,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Stripe createPaymentLink failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { url: string };
    return { url: data.url };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    // Format: t=<timestamp>,v1=<hmac-hex>
    const match = /^t=(\d+),v1=(.+)$/.exec(signature);
    if (!match) return false;
    const timestamp = match[1]!;
    const v1 = match[2]!;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseEvent(rawBody: string): ParsedStripeEvent {
    const e = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    const obj = (e.data?.object ?? {}) as Record<string, unknown>;
    const metadata = (obj['metadata'] as Record<string, unknown> | undefined) ?? {};
    const invoiceId = String(metadata['invoiceId'] ?? '');
    const idempotencyKey = String(metadata['idempotencyKey'] ?? e.id ?? '');
    // Stripe amounts are already in the currency's minor units (e.g. cents for USD).
    const amountMinor = Number(obj['amount_total'] ?? obj['amount_paid'] ?? 0);
    const currency = String(obj['currency'] ?? 'USD').toUpperCase();
    return {
      type: e.type ?? '',
      eventId: e.id ?? '',
      tenantId: String(metadata['tenantId'] ?? ''),
      invoiceId,
      amountMinor,
      currency,
      idempotencyKey,
    };
  }

  async listCompletedCharges(opts: { createdAfter?: number }): Promise<ReconcilePayment[]> {
    const out: ReconcilePayment[] = [];
    let startingAfter: string | undefined;
    do {
      const qs = new URLSearchParams({ status: 'succeeded', limit: '100' });
      if (opts.createdAfter) qs.set('created[gte]', String(Math.floor(opts.createdAfter / 1000)));
      if (startingAfter) qs.set('starting_after', startingAfter);
      const res = await fetch(`https://api.stripe.com/v1/payment_intents?${qs}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      if (!res.ok) {
        throw new Error(`Stripe listPaymentIntents failed: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as { data: Array<Record<string, any>>; has_more: boolean };
      for (const pi of data.data) {
        const meta = (pi['metadata'] ?? {}) as Record<string, unknown>;
        const invoiceId = String(meta['invoiceId'] ?? '');
        const tenantId = String(meta['tenantId'] ?? '');
        if (!invoiceId || !tenantId) continue; // only our invoices carry our metadata
        out.push({
          eventId: String(pi['id'] ?? ''),
          tenantId,
          invoiceId,
          amountMinor: Number(pi['amount_received'] ?? pi['amount'] ?? 0),
          currency: String(pi['currency'] ?? 'USD').toUpperCase(),
          idempotencyKey: String(meta['idempotencyKey'] ?? pi['id'] ?? ''),
        });
      }
      startingAfter =
        data.has_more && data.data.length ? String(data.data[data.data.length - 1]!['id']) : undefined;
    } while (startingAfter);
    return out;
  }
}

/**
 * Test/fallback provider — no network, no keys. `createPaymentLink` returns a
 * deterministic URL and counts calls so idempotency is verifiable; the signature
 * check always passes and `parseEvent` reads the JSON body the test provides.
 */
export class FakePaymentProvider implements PaymentProvider {
  /** Number of times createPaymentLink was actually invoked (idempotency probe). */
  public callCount = 0;

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<{ url: string }> {
    this.callCount++;
    return { url: `https://pay.test/invoice/${input.invoiceId}` };
  }

  verifyWebhookSignature(_rawBody?: string, _signature?: string): boolean {
    return true;
  }

  parseEvent(rawBody: string): ParsedStripeEvent {
    const e = JSON.parse(rawBody) as Partial<ParsedStripeEvent>;
    return {
      type: e.type ?? 'checkout.session.completed',
      eventId: e.eventId ?? 'evt_fake',
      tenantId: e.tenantId ?? '',
      invoiceId: e.invoiceId ?? '',
      amountMinor: e.amountMinor ?? 0,
      currency: (e.currency ?? 'USD').toUpperCase(),
      idempotencyKey: e.idempotencyKey ?? 'idem_fake',
    };
  }

  async listCompletedCharges(): Promise<ReconcilePayment[]> {
    // No real charges in fake mode — nothing to reconcile.
    return [];
  }
}

/**
 * Returns the real provider when both Stripe keys are present, otherwise the fake
 * (mirrors `createEmailSender`). This keeps local/dev and the test suite running
 * with zero configuration.
 */
export function createPaymentProvider(): PaymentProvider {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secretKey && webhookSecret) {
    return new StripePaymentProvider(secretKey, webhookSecret);
  }
  return new FakePaymentProvider();
}

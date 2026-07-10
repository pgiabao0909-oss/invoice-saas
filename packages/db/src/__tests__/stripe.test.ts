import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { FakePaymentProvider, StripePaymentProvider } from '../integrations/stripe.js';

describe('FakePaymentProvider (test double)', () => {
  it('returns a deterministic URL and counts provider calls', async () => {
    const p = new FakePaymentProvider();
    const res = await p.createPaymentLink({
      invoiceId: 'inv_9',
      tenantId: 't1',
      amountMinor: 1500,
      currency: 'USD',
      description: 'Invoice INV-9',
    });
    expect(res.url).toBe('https://pay.test/invoice/inv_9');
    expect(p.callCount).toBe(1);

    await p.createPaymentLink({ invoiceId: 'inv_9', tenantId: 't1', amountMinor: 1, currency: 'USD', description: 'x' });
    expect(p.callCount).toBe(2);
  });

  it('always verifies signatures and parses a supplied event', () => {
    const p = new FakePaymentProvider();
    expect(p.verifyWebhookSignature('anything', 'whatever')).toBe(true);
    const ev = p.parseEvent(
      JSON.stringify({
        type: 'checkout.session.completed',
        eventId: 'evt_1',
        tenantId: 't1',
        invoiceId: 'inv_9',
        amountMinor: 500,
        currency: 'usd',
        idempotencyKey: 'idem_9',
      }),
    );
    expect(ev.invoiceId).toBe('inv_9');
    expect(ev.amountMinor).toBe(500);
    expect(ev.currency).toBe('USD');
    expect(ev.idempotencyKey).toBe('idem_9');
    expect(ev.tenantId).toBe('t1');
  });
});

describe('StripePaymentProvider — signature + parsing', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret';

  it('verifies a known HMAC signature and rejects a tampered body', () => {
    const provider = new StripePaymentProvider('sk_test', WEBHOOK_SECRET);
    const body = '{"id":"evt_1","type":"checkout.session.completed"}';
    const ts = 1700000000;
    const sig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(`${ts}.${body}`)
      .digest('hex');

    expect(provider.verifyWebhookSignature(body, `t=${ts},v1=${sig}`)).toBe(true);
    // Tampered body → signature mismatch.
    expect(provider.verifyWebhookSignature('{"id":"evt_1","tampered":true}', `t=${ts},v1=${sig}`)).toBe(false);
    // Malformed signature header.
    expect(provider.verifyWebhookSignature(body, 'not-a-signature')).toBe(false);
  });

  it('parses a Stripe-shaped event including metadata', () => {
    const provider = new StripePaymentProvider('sk_test', WEBHOOK_SECRET);
    const body = JSON.stringify({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          amount_total: 2000,
          currency: 'usd',
          metadata: { invoiceId: 'inv_7', tenantId: 't1', idempotencyKey: 'idem_7' },
        },
      },
    });
    const ev = provider.parseEvent(body);
    expect(ev.invoiceId).toBe('inv_7');
    expect(ev.amountMinor).toBe(2000);
    expect(ev.currency).toBe('USD');
    expect(ev.idempotencyKey).toBe('idem_7');
    expect(ev.tenantId).toBe('t1');
    expect(ev.eventId).toBe('evt_2');
  });
});

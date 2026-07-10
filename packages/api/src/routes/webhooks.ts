import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { PaymentProvider, recordPayment } from '@invoice-saas/db';

/**
 * T3 — Stripe webhook receiver. Registered WITHOUT `resolveTenant` because the
 * tenant identity comes from the event's metadata (injected at payment-link
 * creation time), not from a request header.
 *
 * The route is a factory so it can be invoked with a fake Prisma client + fake
 * provider under test, defaulting to the real singletons in production.
 */
export interface StripeWebhookDeps {
  prisma: PrismaClient;
  provider: PaymentProvider;
}

export function stripeWebhookRoutes(deps: StripeWebhookDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    // Keep the RAW body as a string so we can verify the Stripe-Signature HMAC
    // (which is computed over the raw bytes). Scoped to this plugin's subtree.
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      done(null, body);
    });

    app.post('/stripe', async (request, reply) => {
      const rawBody = typeof request.body === 'string' ? request.body : '';
      const signature = request.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        return reply.code(400).send({ received: false });
      }
      if (!deps.provider.verifyWebhookSignature(rawBody, signature)) {
        return reply.code(400).send({ received: false });
      }

      const event = deps.provider.parseEvent(rawBody);
      const isPayment =
        event.type === 'checkout.session.completed' ||
        event.type === 'payment_intent.succeeded' ||
        event.type === 'charge.succeeded';

      if (isPayment) {
        try {
          await recordPayment(deps.prisma, event.tenantId, event.invoiceId, {
            amountMinor: event.amountMinor,
            currency: event.currency,
            idempotencyKey: event.idempotencyKey,
            stripeChargeId: event.eventId,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown_error';
          // Terminal, non-retryable outcomes (already paid / illegal state / missing
          // invoice): acknowledge so Stripe stops retrying a doomed event.
          if (
            message === 'ALREADY_PAID' ||
            message === 'ILLEGAL_TRANSITION' ||
            message === 'INVOICE_NOT_FOUND'
          ) {
            request.log.warn({ err: message }, 'webhook payment not applied (terminal)');
            return reply.code(200).send({ received: true });
          }
          throw err; // transient — let Stripe retry
        }
      }

      // Stripe requires a 2xx for every event, including unhandled types.
      return reply.code(200).send({ received: true });
    });
  };
}

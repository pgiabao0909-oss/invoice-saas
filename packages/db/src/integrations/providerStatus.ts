/**
 * Provider liveness for the "no human" deployment contract (guide §C1).
 *
 * The payment and email providers both fall back to no-credential fakes when their
 * keys are absent: `FakePaymentProvider` emits non-collecting `https://pay.test/...`
 * links and `ConsoleEmailSender` only logs. A fully-automated invoice loop running
 * in fake mode therefore SILENTLY never delivers an invoice or collects a payment —
 * the worst failure mode for an unattended system, because nothing errors.
 *
 * `providerStatus` reports the current mode; `startupAssertLive` turns that into a
 * hard boot failure in production so a misconfigured deploy fails loud instead of
 * stalling quiet. The API (webhook signature verification) and the worker (email +
 * payment collection) both call `startupAssertLive` at startup.
 */
export interface ProviderStatus {
  stripeLive: boolean;
  resendLive: boolean;
  paymentMode: 'live' | 'fake';
  emailMode: 'live' | 'fake';
  allLive: boolean;
}

export function providerStatus(
  env: Record<string, string | undefined> = process.env,
): ProviderStatus {
  const stripeLive = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  const resendLive = Boolean(env.RESEND_API_KEY);
  return {
    stripeLive,
    resendLive,
    paymentMode: stripeLive ? 'live' : 'fake',
    emailMode: resendLive ? 'live' : 'fake',
    allLive: stripeLive && resendLive,
  };
}

/**
 * Fail the process loud if production is not fully live. `requireResend` lets the API
 * skip the email check (it never sends mail itself) while still requiring the Stripe
 * webhook secret — without it the fake provider's `verifyWebhookSignature` is a no-op
 * and ANY payload could mark an invoice paid. The worker passes requireResend:true
 * (default) because it owns both email and payment collection.
 */
export function startupAssertLive(
  env: Record<string, string | undefined> = process.env,
  opts: { requireResend?: boolean } = {},
): void {
  const requireResend = opts.requireResend ?? true;
  if (env.NODE_ENV !== 'production') return;

  const status = providerStatus(env);
  const missing: string[] = [];
  if (!status.stripeLive) missing.push('STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET');
  if (requireResend && !status.resendLive) missing.push('RESEND_API_KEY');

  if (missing.length > 0) {
    throw new Error(
      `[boot] REFUSING TO START IN PRODUCTION WITH FAKE PROVIDERS. Missing: ${missing.join(', ')}. ` +
        `In fake mode invoices are never delivered or paid — a "no human" deployment would silently stall.`,
    );
  }
}

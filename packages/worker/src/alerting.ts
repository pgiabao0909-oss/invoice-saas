import type { EmailSender } from './email.js';

/**
 * C5 — failure alerting. A single sink the schedulers call when something goes
 * wrong off the request path: a recurring sweep throws, a reconciliation sweep
 * throws, or a recurring invoice is HELD by the verification gate.
 *
 * Alerts are delivered two ways, deliberately independent:
 *  1. Always logged to stderr (`[ALERT] …`) so a tail captures every failure.
 *  2. If an `ALERT_EMAIL` is configured, emailed through the existing `EmailSender`
 *     seam — no new provider, and a delivery failure never masks the original error.
 *
 * The sink is injected so schedulers stay unit-testable without a real email client.
 */
export interface AlertSink {
  alert(subject: string, message: string): Promise<void>;
}

/** Console-only sink — the default when no alert email is configured. */
export const consoleAlertSink: AlertSink = {
  async alert(subject, message) {
    console.error(`[ALERT] ${subject}: ${message}`);
  },
};

/**
 * Build an alert sink backed by the worker's email sender. When `to` is unset the
 * sink degrades to console-only (local/dev runs need no config). A failed email is
 * logged but never rethrown — alerting must not crash the scheduler that called it.
 */
export function createAlertSink(email: EmailSender, to?: string): AlertSink {
  if (!to) return consoleAlertSink;
  return {
    async alert(subject, message) {
      console.error(`[ALERT] ${subject}: ${message}`);
      try {
        await email.sendInvoice({
          to,
          subject: `[invoice-saas] ${subject}`,
          body: message,
        });
      } catch (err) {
        console.error('[ALERT] failed to deliver alert email', err);
      }
    },
  };
}

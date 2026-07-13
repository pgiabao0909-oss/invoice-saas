import { describe, it, expect, vi } from 'vitest';
import { createAlertSink, consoleAlertSink } from '../alerting.js';
import type { EmailSender } from '../email.js';

/**
 * C5 — the alert sink must:
 *  - degrade to console-only when no ALERT_EMAIL is configured;
 *  - email the configured address (through the existing EmailSender seam) when set;
 *  - NEVER rethrow when the email delivery fails — alerting must not crash the
 *    scheduler that called it.
 */
class CapturingEmailSender implements EmailSender {
  sent: Array<{ to: string; subject: string; body: string }> = [];
  async sendInvoice(input: { to: string; subject: string; body: string }): Promise<void> {
    this.sent.push({ to: input.to, subject: input.subject, body: input.body });
  }
}

class ThrowingEmailSender implements EmailSender {
  async sendInvoice(): Promise<void> {
    throw new Error('provider down');
  }
}

describe('createAlertSink — C5 failure alerting', () => {
  it('degrades to console-only when no address is configured', async () => {
    const email = new CapturingEmailSender();
    const sink = createAlertSink(email); // no `to`
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sink.alert('Recurring sweep failed', 'boom');

    expect(email.sent).toHaveLength(0); // no email attempted
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]!.join(' ')).toContain('Recurring sweep failed');
    spy.mockRestore();
  });

  it('emails the configured address through the EmailSender seam', async () => {
    const email = new CapturingEmailSender();
    const sink = createAlertSink(email, 'ops@acme.test');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sink.alert('Reconciliation failed', 'stripe timeout');

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe('ops@acme.test');
    expect(email.sent[0]!.subject).toContain('Reconciliation failed');
    expect(email.sent[0]!.body).toBe('stripe timeout');
    spy.mockRestore();
  });

  it('never rethrows when the alert email fails to deliver', async () => {
    const sink = createAlertSink(new ThrowingEmailSender(), 'ops@acme.test');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Must resolve, not reject — the caller (a scheduler tick) relies on this.
    await expect(sink.alert('X', 'y')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled(); // the delivery failure is logged
    spy.mockRestore();
  });

  it('consoleAlertSink logs to stderr', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await consoleAlertSink.alert('Subject', 'message');
    expect(spy.mock.calls[0]!.join(' ')).toContain('Subject');
    spy.mockRestore();
  });
});

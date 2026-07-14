export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendInvoiceInput {
  to: string;
  subject: string;
  body: string;
  attachment?: EmailAttachment;
}

export interface EmailSender {
  sendInvoice(input: SendInvoiceInput): Promise<void>;
}

/**
 * A 4xx / missing-recipient failure — retrying the exact same request will never
 * succeed, so the email layer must surface it immediately instead of burning the
 * retry budget. The generic `catch` rethrows this without scheduling another attempt.
 */
export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}

/** Default retry budget for the email layer (consumes 4 of the job's 5 attempts). */
const EMAIL_MAX_ATTEMPTS = 4;
const EMAIL_BASE_MS = 1000;
const EMAIL_CAP_MS = 30_000;

/** 2^(n) backoff for the email layer; injectable `sleep` keeps it testable. */
function backoffMs(attempt: number): number {
  const raw = EMAIL_BASE_MS * 2 ** attempt;
  return Math.min(EMAIL_CAP_MS, raw);
}

/**
 * Local/dev sender — logs instead of calling a provider. No external dependency,
 * so the worker runs end-to-end without credentials. Swap for a real provider in
 * production (the interface is the seam).
 */
export class ConsoleEmailSender implements EmailSender {
  async sendInvoice(input: SendInvoiceInput): Promise<void> {
    console.log(
      `[email] to=${input.to} subject="${input.subject}"` +
        ` attachment=${input.attachment ? input.attachment.filename : 'none'}`,
    );
  }
}

/**
 * Production sender via Resend (no SDK — uses fetch). Falls back to the console
 * sender when RESEND_API_KEY is unset, so local/dev runs need no config.
 *
 * Transient-fault resilience (guide §3.2): a 5xx / network blip is retried with
 * exponential backoff before it ever reaches the durable job-queue retry. Permanent
 * failures (4xx, missing recipient) throw immediately — no point retrying those.
 */
export function createEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return new ConsoleEmailSender();

  return {
    async sendInvoice(input: SendInvoiceInput): Promise<void> {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let lastErr: unknown;
      for (let attempt = 0; attempt < EMAIL_MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM ?? 'invoices@acme.test',
              to: [input.to],
              subject: input.subject,
              text: input.body,
              attachments: input.attachment
                ? [{ filename: input.attachment.filename, content: input.attachment.content.toString('base64') }]
                : undefined,
            }),
          });
          if (res.ok) return;
          // 4xx → permanent; don't burn retries on an unwinnable request.
          if (res.status >= 400 && res.status < 500) {
            throw new PermanentEmailError(`Resend rejected (${res.status}): ${await res.text()}`);
          }
          lastErr = new Error(`Resend transient (${res.status}): ${await res.text()}`);
        } catch (err) {
          // A permanent failure must propagate now — never retry an unwinnable request.
          if (err instanceof PermanentEmailError) throw err;
          lastErr = err;
        }
        if (attempt < EMAIL_MAX_ATTEMPTS - 1) await sleep(backoffMs(attempt));
      }
      throw new Error(`Resend send failed after ${EMAIL_MAX_ATTEMPTS} attempts: ${String(lastErr)}`);
    },
  };
}

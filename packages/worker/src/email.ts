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
 */
export function createEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return new ConsoleEmailSender();

  return {
    async sendInvoice(input: SendInvoiceInput): Promise<void> {
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
      if (!res.ok) {
        throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
      }
    },
  };
}

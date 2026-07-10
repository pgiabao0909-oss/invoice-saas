import { fileURLToPath } from 'node:url';
import { claimNextJob, completeJob, createPaymentProvider, ensurePaymentLink, failJob, prisma, type PaymentProvider } from '@invoice-saas/db';
import type { ClaimedJob } from '@invoice-saas/db';
import { createEmailSender } from './email.js';
import { renderInvoicePdf, type TenantBranding } from './pdf.js';

/**
 * Worker: consumes the durable job queue OFF the request path (ADR 0001).
 * Runs one instance per process; multiple instances scale horizontally because
 * `claimNextJob` uses `FOR UPDATE SKIP LOCKED` — no job is processed twice.
 *
 * This is where email, PDF generation, reminders, and Stripe webhook effects
 * actually execute, so a slow email provider can never block an HTTP request.
 */
const POLL_MS = 1000;
const email = createEmailSender();
const paymentProvider = createPaymentProvider();

export interface EmailInvoiceDeps {
  prisma: typeof prisma;
  email: { sendInvoice(input: { to: string; subject: string; body: string; attachment?: { filename: string; content: Buffer } }): Promise<void> };
  provider: PaymentProvider;
}

/**
 * T2 + T3 — render the branded PDF, obtain an idempotent Stripe payment link, and
 * email both to the client. Extracted from the poll loop so it is unit-testable
 * without a running worker or network.
 */
export async function handleEmailInvoice(
  deps: EmailInvoiceDeps,
  job: ClaimedJob,
): Promise<void> {
  const { invoiceId, tenantId } = job.payload as { invoiceId: string; tenantId: string };
  const invoice = await deps.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) {
    console.warn('[worker] EMAIL_INVOICE: invoice not found', job.payload);
    return;
  }
  const tenant = await deps.prisma.tenant.findUnique({ where: { id: tenantId } });
  const client = await deps.prisma.client.findUnique({ where: { id: invoice.clientId } });

  const pdf = await renderInvoicePdf(
    invoice,
    tenant?.name ?? 'Invoice',
    (tenant?.branding as TenantBranding) ?? {},
  );

  // T3 — ensure the invoice has a payment link (no-op if already created).
  let paymentLink = '';
  try {
    paymentLink = await ensurePaymentLink(deps.provider, deps.prisma, tenantId, {
      id: invoice.id,
      tenantId,
    });
  } catch (err) {
    console.error('[worker] EMAIL_INVOICE: failed to ensure payment link', err);
  }

  const body =
    'Please find your invoice attached. Thank you!' +
    (paymentLink ? `\n\nPay online: ${paymentLink}` : '');

  await deps.email.sendInvoice({
    to: client?.email ?? 'unknown@invalid',
    subject: `Invoice ${invoice.invoiceNumber}`,
    body,
    attachment: { filename: `${invoice.invoiceNumber}.pdf`, content: pdf },
  });
}

async function handleJob(job: ClaimedJob): Promise<void> {
  switch (job.type) {
    case 'EMAIL_INVOICE': {
      await handleEmailInvoice({ prisma, email, provider: paymentProvider }, job);
      break;
    }
    case 'INVOICE_SENT':
      console.log('[worker] outbox relay INVOICE_SENT', JSON.stringify(job.payload));
      break;
    case 'INVOICE_OVERDUE':
      // TODO(T4): send reminder email.
      console.log('[worker] INVOICE_OVERDUE', JSON.stringify(job.payload));
      break;
    default:
      console.warn('[worker] unknown job type', job.type);
  }
}

async function loop(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimNextJob(prisma);
    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    try {
      await handleJob(job);
      await completeJob(prisma, job.id);
    } catch (err) {
      console.error('[worker] job failed', job.id, err);
      await failJob(prisma, job.id);
    }
  }
}

const isMain =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  loop().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

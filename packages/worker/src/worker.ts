import { fileURLToPath } from 'node:url';
import { claimNextJob, completeJob, failJob, prisma } from '@invoice-saas/db';
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

async function handleJob(job: ClaimedJob): Promise<void> {
  switch (job.type) {
    case 'EMAIL_INVOICE': {
      // T2 — render the branded PDF and email it to the client.
      const { invoiceId, tenantId } = job.payload as { invoiceId: string; tenantId: string };
      const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
      if (!invoice) {
        console.warn('[worker] EMAIL_INVOICE: invoice not found', job.payload);
        return;
      }
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const client = await prisma.client.findUnique({ where: { id: invoice.clientId } });
      const pdf = await renderInvoicePdf(
        invoice,
        tenant?.name ?? 'Invoice',
        (tenant?.branding as TenantBranding) ?? {},
      );
      await email.sendInvoice({
        to: client?.email ?? 'unknown@invalid',
        subject: `Invoice ${invoice.invoiceNumber}`,
        body: 'Please find your invoice attached. Thank you!',
        attachment: { filename: `${invoice.invoiceNumber}.pdf`, content: pdf },
      });
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

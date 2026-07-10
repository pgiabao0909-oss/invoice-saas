import { fileURLToPath } from 'node:url';
import {
  claimNextJob,
  completeJob,
  createPaymentProvider,
  ensurePaymentLink,
  failJob,
  prisma,
  recordAudit,
  sweepAllTenants,
  AUDIT_EVENTS,
  type PaymentProvider,
} from '@invoice-saas/db';
import type { ClaimedJob } from '@invoice-saas/db';
import { createEmailSender, type EmailSender } from './email.js';
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

export interface SendReminderDeps {
  prisma: typeof prisma;
  email: EmailSender;
}

/**
 * T4 — send an overdue reminder for an INVOICE_REMINDER job. Loads the invoice by
 * (id, tenantId) from the job payload (never trusts the id alone) and emails the
 * client. A FRESHNESS GUARD skips the email if the invoice is no longer outstanding
 * (e.g. it was paid or voided after the reminder job was enqueued), so a stale job
 * can never nag a customer who already paid.
 */
export async function handleReminder(
  deps: SendReminderDeps,
  job: ClaimedJob,
): Promise<void> {
  const { invoiceId, tenantId } = job.payload as { invoiceId: string; tenantId: string };
  const invoice = await deps.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) {
    console.warn('[worker] INVOICE_REMINDER: invoice not found', job.payload);
    return;
  }
  if (invoice.status === 'paid' || invoice.status === 'void') {
    console.log('[worker] INVOICE_REMINDER: invoice no longer outstanding, skipping', invoiceId, invoice.status);
    return;
  }
  const client = await deps.prisma.client.findUnique({ where: { id: invoice.clientId } });
  await deps.email.sendInvoice({
    to: client?.email ?? 'unknown@invalid',
    subject: `Overdue invoice ${invoice.invoiceNumber}`,
    body: `Invoice ${invoice.invoiceNumber} is overdue. Please pay at your earliest convenience.`,
  });
  // Append to the immutable trail that this dunning email actually went out.
  await recordAudit(deps.prisma, {
    tenantId,
    invoiceId,
    event: AUDIT_EVENTS.REMINDER_SENT,
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
    case 'INVOICE_REMINDER':
      await handleReminder({ prisma, email }, job);
      break;
    case 'INVOICE_OVERDUE':
      // Reserved outbox type; reminders are driven by INVOICE_REMINDER jobs (T4).
      console.log('[worker] INVOICE_OVERDUE (no-op)', JSON.stringify(job.payload));
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
      // Durable retry: requeue with exponential backoff, or park as FAILED once
      // attempts are exhausted (guide §3.2). `attempts` on the claimed job is the
      // post-claim count, so the first failure waits the base delay.
      await failJob(prisma, job, { error: err });
    }
  }
}

const OVERDUE_SWEEP_MS = Number(process.env.OVERDUE_SWEEP_MS ?? 60_000);

/**
 * Hands-off dunning (guide §4.3): runs the overdue sweep on a timer so invoices are
 * flipped + reminders are queued automatically — no manual button, no cron entry
 * required. The sweep is internally idempotent, so running it every minute only acts
 * on invoices that newly crossed their due date. Returns the interval handle.
 */
export function startOverdueScheduler(
  db: typeof prisma = prisma,
  intervalMs: number = OVERDUE_SWEEP_MS,
): ReturnType<typeof setInterval> {
  const tick = async (): Promise<void> => {
    try {
      const r = await sweepAllTenants(db);
      if (r.flipped > 0 || r.remindersEnqueued > 0) {
        console.log(`[worker] overdue sweep flipped=${r.flipped} reminders=${r.remindersEnqueued}`);
      }
    } catch (err) {
      console.error('[worker] overdue sweep failed', err);
    }
  };
  void tick();
  return setInterval(tick, intervalMs);
}

const isMain =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  startOverdueScheduler();
  loop().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

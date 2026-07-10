import { fileURLToPath } from 'node:url';
import { detectOverdue, prisma } from '@invoice-saas/db';

/**
 * T4 — overdue scheduler entry point. Intended to run on a cron (e.g. once daily):
 *
 *   node -e "import('./src/overdue-check.ts')"   # or compiled dist equivalent
 *
 * It sweeps every tenant (one `detectOverdue` call per tenant, each internally
 * idempotent) and enqueues INVOICE_REMINDER jobs for any newly-overdue invoices.
 * Per-tenant calls isolate failures and keep the sweep safe to re-run.
 */
async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const asOf = new Date();
  let totalFlipped = 0;
  let totalReminders = 0;
  for (const t of tenants) {
    const r = await detectOverdue(prisma, t.id, asOf);
    totalFlipped += r.flipped;
    totalReminders += r.remindersEnqueued;
  }
  console.log(
    `[overdue-check] tenants=${tenants.length} flipped=${totalFlipped} remindersEnqueued=${totalReminders}`,
  );
}

const isMain =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

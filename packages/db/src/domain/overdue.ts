import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { TenantId } from '@invoice-saas/contracts';

/**
 * T4 — overdue detection + reminder scheduling.
 *
 * Tenant-scoped: a sweep processes ONE tenant at a time, so a failure on tenant A
 * can never block tenant B, and the query can never touch another tenant's rows.
 * The scheduler (packages/worker/src/overdue-check.ts) and the admin trigger
 * (packages/api/src/routes/admin.ts) loop over tenants and call this per tenant.
 *
 * Date math uses exact millisecond offsets from the due date (not `setDate`/local
 * calendar arithmetic) so reminder availability is immune to DST / timezone shifts.
 */
const REMINDER_OFFSETS_DAYS = [1, 7, 14] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OverdueSweepResult {
  /** Number of invoices flipped sent → overdue. */
  flipped: number;
  /** Number of INVOICE_REMINDER jobs enqueued. */
  remindersEnqueued: number;
}

/**
 * Flip this tenant's sent invoices that are past due AND still carry a balance to
 * `overdue`, and enqueue three reminder jobs (day +1 / +7 / +14 after the due date).
 *
 * Idempotency / no double-flip: each candidate is re-checked inside its own
 * transaction. If a prior run already moved it to `overdue` (or it was since paid),
 * the transaction is a no-op and no reminders are enqueued — so re-running the sweep
 * never produces duplicate reminder emails.
 */
export async function detectOverdue(
  prisma: PrismaClient,
  tenantId: TenantId,
  asOf: Date,
): Promise<OverdueSweepResult> {
  // Candidate set: this tenant's SENT invoices already past their due date.
  const candidates = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: 'sent',
      dueDate: { lt: asOf },
    },
  });

  // Only invoices with an OUTSTANDING balance actually become overdue. (The balance
  // check is done in JS rather than a column-comparison filter so the same code path
  // runs unchanged against the test fake and against Postgres.)
  const due = candidates.filter((i) => i.amountPaidMinor < i.totalMinor);

  let flipped = 0;
  let remindersEnqueued = 0;

  for (const invoice of due) {
    await prisma.$transaction(async (tx) => {
      // Re-check the latest state under the transaction before mutating — the
      // backstop against double-flipping / duplicate reminders on a re-run.
      const current = await tx.invoice.findFirst({ where: { id: invoice.id, tenantId } });
      if (!current || current.status !== 'sent') return;
      if (current.amountPaidMinor >= current.totalMinor) return;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'overdue' },
      });

      for (let idx = 0; idx < REMINDER_OFFSETS_DAYS.length; idx++) {
        const offsetDays = REMINDER_OFFSETS_DAYS[idx]!;
        const availableAt = new Date(invoice.dueDate.getTime() + offsetDays * DAY_MS);
        await tx.job.create({
          data: {
            type: 'INVOICE_REMINDER',
            payload: { invoiceId: invoice.id, tenantId, reminderIndex: idx } as Prisma.InputJsonValue,
            availableAt,
          },
        });
        remindersEnqueued++;
      }
      flipped++;
    });
  }

  return { flipped, remindersEnqueued };
}

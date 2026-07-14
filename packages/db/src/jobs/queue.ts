import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Durable job queue on Postgres (ADR 0001). No Redis needed for correctness;
 * a later ticket can swap in BullMQ behind this same interface if throughput
 * demands it. The worker (packages/worker) claims and runs jobs off the
 * request path.
 */
export interface JobEnqueuer {
  enqueue(type: string, payload: unknown): Promise<void>;
}

export class PostgresJobQueue implements JobEnqueuer {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(type: string, payload: unknown): Promise<void> {
    await this.prisma.job.create({
      data: { type, payload: payload as Prisma.InputJsonValue },
    });
  }
}

export interface ClaimedJob {
  id: string;
  type: string;
  payload: unknown;
  /** Attempt count AFTER this claim (the claim increments it). First run = 1. */
  attempts: number;
  /** Retry ceiling for this job. */
  maxAttempts: number;
}

/**
 * Atomically claim the next due PENDING job using `FOR UPDATE SKIP LOCKED`, so
 * multiple worker instances scale horizontally without double-processing.
 * Returns null when the queue is empty.
 */
export async function claimNextJob(prisma: PrismaClient): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<Array<ClaimedJob & { payload: Prisma.JsonValue }>>`
    UPDATE "Job"
    SET status = 'RUNNING', attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job"
      WHERE status = 'PENDING' AND "availableAt" <= now()
      ORDER BY "availableAt" ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts, "maxAttempts";
  `;
  return rows[0] ?? null;
}

export async function completeJob(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.job.update({ where: { id }, data: { status: 'DONE' } });
}

/**
 * Exponential backoff for a failed job (guide §3.2 — "wait and try again, e.g. 3
 * times with exponential backoff"). Pure and time-free so it is trivially testable:
 * delay = base × 2^(attempts−1), capped. `attempts` is the post-claim count, so the
 * first failure (attempts=1) waits `base`, the second waits `2×base`, and so on.
 */
export function computeBackoffMs(attempts: number, baseMs = 1000, capMs = 3_600_000): number {
  const exp = Math.max(0, attempts - 1);
  // Guard the shift against absurd exponents before capping.
  const raw = exp > 40 ? capMs : baseMs * 2 ** exp;
  return Math.min(capMs, raw);
}

export interface FailJobResult {
  /** True when the job was rescheduled for another attempt; false when parked FAILED. */
  retried: boolean;
  /** When retried, the time the job becomes eligible again. */
  availableAt?: Date;
}

/**
 * Handle a job failure with durable retry. If the job still has attempts left, it is
 * returned to PENDING with `availableAt` pushed out by the backoff delay, so a
 * transient fault (network blip, provider 5xx) is retried automatically off the
 * request path. Once attempts are exhausted it is parked as FAILED with the last
 * error recorded, so it never silently vanishes.
 */
export async function failJob(
  prisma: PrismaClient,
  job: Pick<ClaimedJob, 'id' | 'attempts' | 'maxAttempts'>,
  opts: { error?: unknown; now?: Date; baseMs?: number; capMs?: number } = {},
): Promise<FailJobResult> {
  const message =
    opts.error instanceof Error ? opts.error.message : opts.error != null ? String(opts.error) : null;

  if (job.attempts < job.maxAttempts) {
    const now = opts.now ?? new Date();
    const availableAt = new Date(now.getTime() + computeBackoffMs(job.attempts, opts.baseMs, opts.capMs));
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'PENDING', availableAt, lastError: message },
    });
    return { retried: true, availableAt };
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'FAILED', lastError: message },
  });
  return { retried: false };
}

/**
 * Relay unpublished outbox messages into the job queue (idempotent: marks each
 * published). This is the relay that turns the transactional outbox into work.
 */
export async function relayOutbox(prisma: PrismaClient): Promise<number> {
  const pending = await prisma.outboxMessage.findMany({
    where: { published: false },
    take: 100,
  });
  for (const msg of pending) {
    await prisma.job.create({ data: { type: msg.type, payload: msg.payload as Prisma.InputJsonValue } });
    await prisma.outboxMessage.update({
      where: { id: msg.id },
      data: { published: true },
    });
  }
  return pending.length;
}

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
    RETURNING id, type, payload;
  `;
  return rows[0] ?? null;
}

export async function completeJob(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.job.update({ where: { id }, data: { status: 'DONE' } });
}

export async function failJob(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.job.update({ where: { id }, data: { status: 'FAILED' } });
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

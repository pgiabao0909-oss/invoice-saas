import { describe, it, expect } from 'vitest';
import { computeBackoffMs, failJob } from '../jobs/queue.js';

/**
 * Proves the durable job-queue retry (guide §3.2 — "wait and try again, e.g. 3 times
 * with exponential backoff"). Without a database: `computeBackoffMs` is a pure,
 * time-free function, and `failJob` is exercised against a fake prisma that inspects
 * the update it would persist.
 */
describe('computeBackoffMs — exponential backoff', () => {
  it('grows exponentially: base, 2×, 4×, 8×', () => {
    expect(computeBackoffMs(1, 1000)).toBe(1000);
    expect(computeBackoffMs(2, 1000)).toBe(2000);
    expect(computeBackoffMs(3, 1000)).toBe(4000);
    expect(computeBackoffMs(4, 1000)).toBe(8000);
  });

  it('is capped', () => {
    expect(computeBackoffMs(20, 1000, 30_000)).toBe(30_000);
  });
});

/**
 * Fake prisma that records the final `job.update` call so we can assert the retry
 * decision: reschedule-with-backoff vs park-as-FAILED.
 */
function fakeJobPrisma() {
  let last: any = null;
  const prisma: any = {
    job: { update: async (a: { where: { id: string }; data: any }) => { last = a.data; return {}; } },
  };
  return { prisma, get: () => last };
}

describe('failJob — retry vs park', () => {
  it('reschedules a job with availableAt pushed out by the backoff while attempts remain', async () => {
    const { prisma, get } = fakeJobPrisma();
    const now = new Date('2026-01-01T00:00:00Z');
    const res = await failJob(
      prisma,
      { id: 'j1', attempts: 1, maxAttempts: 5 },
      { error: new Error('boom'), now },
    );
    expect(res.retried).toBe(true);
    expect(get().status).toBe('PENDING');
    expect(get().lastError).toBe('boom');
    // attempts=1 → base 1000ms backoff.
    expect(get().availableAt.getTime()).toBe(now.getTime() + 1000);
  });

  it('parks the job as FAILED once attempts are exhausted', async () => {
    const { prisma, get } = fakeJobPrisma();
    const res = await failJob(
      prisma,
      { id: 'j1', attempts: 5, maxAttempts: 5 },
      { error: new Error('permanent') },
    );
    expect(res.retried).toBe(false);
    expect(get().status).toBe('FAILED');
    expect(get().lastError).toBe('permanent');
  });
});

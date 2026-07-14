import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmailSender } from '../email.js';

/**
 * Proves the email layer's transient-fault resilience (guide §3.2): a 5xx / network
 * blip is retried with exponential backoff before the durable job-queue retry kicks
 * in, while a 4xx fails fast (no point retrying an unwinnable request).
 *
 * `setTimeout` is stubbed to fire immediately so the backoff delays don't slow the
 * test; we only assert the number of attempts and the outcome.
 */
function jsonResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => `body-${status}`,
  } as unknown as Response;
}

describe('createEmailSender — transient retry', () => {
  const originalKey = process.env.RESEND_API_KEY;
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('setTimeout', ((fn: (...a: unknown[]) => void) => { fn(); return 0 as unknown as NodeJS.Timeout; }) as typeof setTimeout);
  });
  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries on 5xx and eventually succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    const sender = createEmailSender();
    await expect(
      sender.sendInvoice({ to: 'c@x.com', subject: 'Inv', body: 'hi' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retry budget and throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503));
    vi.stubGlobal('fetch', fetchMock);

    const sender = createEmailSender();
    await expect(
      sender.sendInvoice({ to: 'c@x.com', subject: 'Inv', body: 'hi' }),
    ).rejects.toThrow(/after 4 attempts/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('fails fast on a 4xx (permanent error, no retries)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400));
    vi.stubGlobal('fetch', fetchMock);

    const sender = createEmailSender();
    await expect(
      sender.sendInvoice({ to: 'c@x.com', subject: 'Inv', body: 'hi' }),
    ).rejects.toThrow(/Resend rejected/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

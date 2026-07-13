import { describe, it, expect } from 'vitest';
import { providerStatus, startupAssertLive } from '../integrations/providerStatus.js';

describe('providerStatus', () => {
  it('reports fake mode when keys are absent', () => {
    const s = providerStatus({});
    expect(s.stripeLive).toBe(false);
    expect(s.resendLive).toBe(false);
    expect(s.allLive).toBe(false);
    expect(s.paymentMode).toBe('fake');
    expect(s.emailMode).toBe('fake');
  });

  it('reports live mode when all keys are present', () => {
    const s = providerStatus({
      STRIPE_SECRET_KEY: 'sk',
      STRIPE_WEBHOOK_SECRET: 'wh',
      RESEND_API_KEY: 'rk',
    });
    expect(s.stripeLive).toBe(true);
    expect(s.resendLive).toBe(true);
    expect(s.allLive).toBe(true);
    expect(s.paymentMode).toBe('live');
    expect(s.emailMode).toBe('live');
  });

  it('is partially live when only Stripe is configured', () => {
    const s = providerStatus({ STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh' });
    expect(s.stripeLive).toBe(true);
    expect(s.resendLive).toBe(false);
    expect(s.allLive).toBe(false);
  });
});

describe('startupAssertLive', () => {
  it('does nothing outside production', () => {
    expect(() => startupAssertLive({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => startupAssertLive({})).not.toThrow();
  });

  it('throws in production with no providers', () => {
    expect(() => startupAssertLive({ NODE_ENV: 'production' })).toThrow(/FAKE PROVIDERS/);
  });

  it('throws when only Stripe is set but Resend is required (worker gate)', () => {
    expect(() =>
      startupAssertLive({ NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh' }),
    ).toThrow(/RESEND_API_KEY/);
  });

  it('passes in production when all providers are live', () => {
    expect(() =>
      startupAssertLive({
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk',
        STRIPE_WEBHOOK_SECRET: 'wh',
        RESEND_API_KEY: 'rk',
      }),
    ).not.toThrow();
  });

  it('API gate (requireResend:false) passes with only Stripe in production', () => {
    expect(() =>
      startupAssertLive(
        { NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'wh' },
        { requireResend: false },
      ),
    ).not.toThrow();
  });
});

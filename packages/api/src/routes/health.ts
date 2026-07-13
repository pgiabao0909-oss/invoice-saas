import type { FastifyInstance } from 'fastify';
import { providerStatus } from '@invoice-saas/db';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const p = providerStatus();
    // `ok` reflects whether the system is fully live (real Stripe + Resend). A
    // "no human" deployment in fake mode silently never delivers or collects, so
    // watchers should alert on `ok:false` / `degraded:true` (guide §C1).
    return {
      ok: p.allLive,
      degraded: !p.allLive,
      ts: new Date().toISOString(),
      providers: { stripe: p.paymentMode, resend: p.emailMode },
    };
  });
}

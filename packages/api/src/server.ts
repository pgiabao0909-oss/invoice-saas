import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Load env from the repo-root .env (created via `cp .env.example .env`). npm runs
// this workspace script with cwd = packages/api, so the repo root is three levels
// up from this file.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod';
import { createPaymentProvider, prisma, startupAssertLive } from '@invoice-saas/db';
import { healthRoutes } from './routes/health.js';
import { invoiceRoutes } from './routes/invoices.js';
import { clientRoutes } from './routes/clients.js';
import { tenantRoutes } from './routes/tenants.js';
import { meRoutes } from './routes/me.js';
import { ingestRoutes } from './routes/ingest.js';
import { auditRoutes } from './routes/audit.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { stripeWebhookRoutes } from './routes/webhooks.js';
import { adminRoutes } from './routes/admin.js';
import { registerIsolationGuard } from './plugins/isolation.js';
import './types.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Validate/serialize every request & response against the shared Zod schemas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.withTypeProvider<ZodTypeProvider>();

  await app.register(healthRoutes);
  await app.register(invoiceRoutes);
  // UI build — read/write endpoints the web app consumes (via Next.js same-origin
  // rewrite; no CORS needed). clients/me are tenant-scoped; tenants is not (onboarding).
  await app.register(clientRoutes);
  await app.register(meRoutes);
  await app.register(tenantRoutes);
  // UI build — automation trigger: an upstream system pushes work and the system
  // drafts → verifies → auto-sends it (guide §2.1). Tenant-scoped.
  await app.register(ingestRoutes);
  // UI build — immutable audit trail reader (guide §2.5). Tenant-scoped.
  await app.register(auditRoutes);
  // C2 — recurring billing configuration (tenant-scoped). The worker's scheduler
  // generates the invoices; this just manages the schedules.
  await app.register(subscriptionRoutes);
  // T3 — Stripe webhook. No resolveTenant; tenant comes from event metadata.
  await app.register(stripeWebhookRoutes({ prisma, provider: createPaymentProvider() }), {
    prefix: '/webhooks',
  });
  // T4 — manual overdue-sweep trigger (NO auth in MVP; see route file).
  await app.register(adminRoutes({ prisma }), { prefix: '/admin' });

  // C6 — tenant isolation guard: inspects every tenant-scoped JSON response for
  // cross-tenant entities (see plugins/isolation.ts). Registered last so it wraps
  // all routes above.
  registerIsolationGuard(app);

  return app;
}

// Start the server only when this module is the entry point (not under import/test).
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  // C1 — fail loud: never boot production with the Stripe webhook secret unset. In
  // fake mode the webhook signature check is a no-op, so ANY payload could mark an
  // invoice paid. The worker gate additionally requires Resend (it sends the mail).
  startupAssertLive(process.env, { requireResend: false });
  const app = await buildServer();
  // Default to 3001 so the API never clashes with the web app (Next dev on :3000)
  // and matches the web's same-origin rewrite (/api/* -> http://localhost:3001).
  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`api listening on :${port}`);
}

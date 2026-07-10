import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod';
import { createPaymentProvider, prisma } from '@invoice-saas/db';
import { healthRoutes } from './routes/health.js';
import { invoiceRoutes } from './routes/invoices.js';
import { stripeWebhookRoutes } from './routes/webhooks.js';
import { adminRoutes } from './routes/admin.js';
import './types.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Validate/serialize every request & response against the shared Zod schemas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.withTypeProvider<ZodTypeProvider>();

  await app.register(healthRoutes);
  await app.register(invoiceRoutes);
  // T3 — Stripe webhook. No resolveTenant; tenant comes from event metadata.
  await app.register(stripeWebhookRoutes({ prisma, provider: createPaymentProvider() }), {
    prefix: '/webhooks',
  });
  // T4 — manual overdue-sweep trigger (NO auth in MVP; see route file).
  await app.register(adminRoutes({ prisma }), { prefix: '/admin' });

  return app;
}

// Start the server only when this module is the entry point (not under import/test).
import { fileURLToPath } from 'node:url';
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`api listening on :${port}`);
}

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod';
import { healthRoutes } from './routes/health.js';
import { invoiceRoutes } from './routes/invoices.js';
import './types.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Validate/serialize every request & response against the shared Zod schemas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.withTypeProvider<ZodTypeProvider>();

  await app.register(healthRoutes);
  await app.register(invoiceRoutes);

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

import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  ApiErrorSchema,
  IngestResultSchema,
  IngestSchema,
  z,
} from '@invoice-saas/contracts';
import { clientForTenant, getTenant, ingestWork, prisma } from '@invoice-saas/db';
import { resolveTenant } from '../plugins/tenant.js';

/**
 * Automation trigger (guide §2.1 — "a very basic API endpoint... ideal for true
 * automation"). An upstream system pushes a unit of work and the system handles the
 * rest: draft → verify → auto-send → audit, with no human in the loop.
 *
 * This is the ONE endpoint a CRM / store / webhook needs to call. Everything else in
 * the automation (delivery, reminders, overdue sweeps) happens off the request path.
 */
export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/ingest',
    {
      preHandler: resolveTenant,
      schema: {
        body: IngestSchema,
        response: { 201: IngestResultSchema, 401: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      const db = clientForTenant(tenant);
      const tenantRecord = await getTenant(db, tenant.id);
      const result = await ingestWork(prisma, tenant.id, request.body, {
        baseCurrency: tenantRecord?.baseCurrency,
      });
      return reply.code(201).send(result);
    },
  );
}

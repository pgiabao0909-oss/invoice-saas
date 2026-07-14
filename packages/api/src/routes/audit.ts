import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  ApiErrorSchema,
  AuditListQuerySchema,
  AuditLogEntrySchema,
  z,
} from '@invoice-saas/contracts';
import { clientForTenant, listAudit } from '@invoice-saas/db';
import { resolveTenant } from '../plugins/tenant.js';

/**
 * Read the immutable audit trail (guide §2.5). Tenant-scoped by the `x-tenant-slug`
 * header; optionally filter to a single invoice. Most-recent-first.
 */
export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/audit',
    {
      preHandler: resolveTenant,
      schema: {
        querystring: AuditListQuerySchema,
        response: { 200: z.array(AuditLogEntrySchema), 401: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      const db = clientForTenant(tenant);
      const entries = await listAudit(db, tenant.id, request.query);
      return reply.code(200).send(entries);
    },
  );
}

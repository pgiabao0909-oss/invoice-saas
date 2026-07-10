import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { ApiErrorSchema, InvoiceCreateSchema, InvoiceSchema } from '@invoice-saas/contracts';
import { clientForTenant, createInvoice } from '@invoice-saas/db';
import { resolveTenant } from '../plugins/tenant.js';

// T1 — create a draft invoice. Input/output validated by the shared Zod schemas,
// so the wire format and the DB write can never disagree (ADR 0001).
export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/invoices',
    {
      preHandler: resolveTenant,
      schema: {
        body: InvoiceCreateSchema,
        response: {
          201: InvoiceSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      // resolveTenant guarantees request.tenant is set (and hijacks on failure).
      const tenant = request.tenant!;
      const db = clientForTenant(tenant);
      const invoice = await createInvoice(db, tenant.id, request.body);
      return reply.code(201).send(invoice);
    },
  );
}

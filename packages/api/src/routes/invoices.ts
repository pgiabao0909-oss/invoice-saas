import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  ApiErrorSchema,
  InvoiceCreateSchema,
  InvoiceIdSchema,
  InvoiceSchema,
  z,
} from '@invoice-saas/contracts';
import { clientForTenant, createInvoice, markSent, prisma } from '@invoice-saas/db';
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
        response: { 201: InvoiceSchema, 401: ApiErrorSchema, 404: ApiErrorSchema },
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

  // T2 — send a draft invoice: transitions draft → sent, writes the outbox +
  // EMAIL_INVOICE job in one transaction (no dual-write gap), worker emails the PDF.
  app.withTypeProvider<ZodTypeProvider>().post(
    '/invoices/:id/send',
    {
      preHandler: resolveTenant,
      schema: {
        params: z.object({ id: InvoiceIdSchema }),
        response: { 200: InvoiceSchema, 401: ApiErrorSchema, 404: ApiErrorSchema, 409: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      try {
        const invoice = await markSent(prisma, tenant.id, request.params.id);
        return reply.code(200).send(invoice);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown_error';
        if (message === 'INVOICE_NOT_FOUND') {
          return reply.code(404).send({ error: 'not_found', message: 'invoice not found' });
        }
        if (message === 'INVOICE_NOT_DRAFT') {
          return reply
            .code(409)
            .send({ error: 'conflict', message: 'invoice is not in draft state' });
        }
        throw err;
      }
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { ApiErrorSchema, ClientCreateSchema, ClientSchema, z } from '@invoice-saas/contracts';
import { clientForTenant, createClient, listClients } from '@invoice-saas/db';
import type { Prisma } from '@prisma/client';
import { resolveTenant } from '../plugins/tenant.js';

// UI build — client management for a tenant.
export async function clientRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/clients',
    {
      preHandler: resolveTenant,
      schema: {
        response: { 200: z.array(ClientSchema), 401: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      const db = clientForTenant(tenant);
      const clients = await listClients(db, tenant.id);
      return reply.code(200).send(clients);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/clients',
    {
      preHandler: resolveTenant,
      schema: {
        body: ClientCreateSchema,
        response: { 201: ClientSchema, 401: ApiErrorSchema, 409: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      const db = clientForTenant(tenant);
      try {
        const client = await createClient(db, tenant.id, request.body);
        return reply.code(201).send(client);
      } catch (err) {
        // Prisma unique-constraint violation on (tenantId, email).
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          return reply
            .code(409)
            .send({ error: 'conflict', message: 'a client with that email already exists' });
        }
        throw err;
      }
    },
  );
}

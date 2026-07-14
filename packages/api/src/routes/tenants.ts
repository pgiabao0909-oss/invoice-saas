import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { ApiErrorSchema, TenantCreateSchema, TenantSchema, z } from '@invoice-saas/contracts';
import { createTenant, listTenants, prisma } from '@invoice-saas/db';
import type { Prisma } from '@prisma/client';

/**
 * UI build — workspace (tenant) management. Deliberately NOT behind resolveTenant:
 * these endpoints let a fresh browser discover existing workspaces and onboard a new
 * one before any `x-tenant-slug` exists. In production this is where real signup /
 * account provisioning would live (out of MVP scope).
 */
export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/tenants',
    { schema: { response: { 200: z.array(TenantSchema) } } },
    async (_request, reply) => {
      const tenants = await listTenants(prisma);
      return reply.code(200).send(tenants);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/tenants',
    {
      schema: {
        body: TenantCreateSchema,
        response: { 201: TenantSchema, 409: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        const tenant = await createTenant(prisma, request.body);
        return reply.code(201).send(tenant);
      } catch (err) {
        // Unique-constraint on slug.
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          return reply
            .code(409)
            .send({ error: 'conflict', message: 'a workspace with that slug already exists' });
        }
        throw err;
      }
    },
  );
}

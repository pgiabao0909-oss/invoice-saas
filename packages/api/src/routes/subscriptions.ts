import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  ApiErrorSchema,
  SubscriptionCreateSchema,
  SubscriptionSchema,
  z,
} from '@invoice-saas/contracts';
import { createSubscription, listSubscriptions, prisma } from '@invoice-saas/db';
import { resolveTenant } from '../plugins/tenant.js';

// C2 — recurring billing configuration (tenant-scoped). The worker's scheduler is
// what actually generates the invoices; this endpoint just manages the schedules.
export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/subscriptions',
    {
      preHandler: resolveTenant,
      schema: { response: { 200: z.array(SubscriptionSchema), 401: ApiErrorSchema } },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      const subs = await listSubscriptions(prisma, tenant.id);
      return reply.code(200).send(subs);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/subscriptions',
    {
      preHandler: resolveTenant,
      schema: {
        body: SubscriptionCreateSchema,
        response: { 201: SubscriptionSchema, 401: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const tenant = request.tenant!;
      const input = { ...request.body, currency: request.body.currency ?? tenant.baseCurrency };
      const sub = await createSubscription(prisma, tenant.id, input);
      return reply.code(201).send(sub);
    },
  );
}

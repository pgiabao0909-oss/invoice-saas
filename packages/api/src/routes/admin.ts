import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { OverdueCheckResultSchema } from '@invoice-saas/contracts';
import { sweepAllTenants } from '@invoice-saas/db';
import { requireAdminToken } from '../plugins/admin-auth.js';

/**
 * T4 — manual trigger for the overdue sweep. The production path is the durable
 * scheduler (packages/worker/src/overdue-check.ts, run on a timer); this route exists
 * for ops/debug and end-to-end testing.
 *
 * SECURITY: protected by `requireAdminToken` — a request must carry
 * `Authorization: Bearer <ADMIN_API_TOKEN>`. Unconfigured or wrong token → 401.
 *
 * The route is a factory so it can be invoked with a fake Prisma under test,
 * defaulting to the real singleton in production.
 */
export interface AdminDeps {
  prisma: PrismaClient;
}

export function adminRoutes(deps: AdminDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.withTypeProvider<ZodTypeProvider>().post(
      '/run-overdue',
      {
        preHandler: requireAdminToken,
        schema: {
          response: { 200: OverdueCheckResultSchema },
        },
      },
      async (_request, reply) => {
        const result = await sweepAllTenants(deps.prisma, new Date());
        return reply.code(200).send({ flipped: result.flipped, remindersEnqueued: result.remindersEnqueued });
      },
    );
  };
}

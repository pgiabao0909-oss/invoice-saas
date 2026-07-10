import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { OverdueCheckResultSchema } from '@invoice-saas/contracts';
import { detectOverdue } from '@invoice-saas/db';
import { requireAdminToken } from '../plugins/admin-auth.js';

/**
 * T4 — manual trigger for the overdue sweep. The production path is the durable
 * scheduler (packages/worker/src/overdue-check.ts, run by cron); this route exists
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
        // Sweep every tenant; per-tenant calls keep a failure on one tenant from
        // aborting the others, and each call is internally idempotent.
        const tenants = await deps.prisma.tenant.findMany({ select: { id: true } });
        const asOf = new Date();
        let flipped = 0;
        let remindersEnqueued = 0;
        for (const t of tenants) {
          const r = await detectOverdue(deps.prisma, t.id, asOf);
          flipped += r.flipped;
          remindersEnqueued += r.remindersEnqueued;
        }
        return reply.code(200).send({ flipped, remindersEnqueued });
      },
    );
  };
}

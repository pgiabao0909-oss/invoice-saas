import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  ApiErrorSchema,
  BrandingUpdateSchema,
  DashboardStatsSchema,
  TenantSchema,
  z,
} from '@invoice-saas/contracts';
import { clientForTenant, getStats, getTenant, updateBranding } from '@invoice-saas/db';
import { resolveTenant } from '../plugins/tenant.js';

const MeSchema = z.object({ tenant: TenantSchema, stats: DashboardStatsSchema });

/**
 * UI build — "current workspace" endpoint. Resolves the tenant from x-tenant-slug and
 * returns its full record plus dashboard KPIs in one round-trip, so the app shell can
 * render header branding + dashboard without two calls.
 */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      preHandler: resolveTenant,
      schema: { response: { 200: MeSchema, 401: ApiErrorSchema, 404: ApiErrorSchema } },
    },
    async (request, reply) => {
      const route = request.tenant!;
      const db = clientForTenant(route);
      const tenant = await getTenant(db, route.id);
      if (!tenant) {
        return reply.code(404).send({ error: 'not_found', message: 'tenant not found' });
      }
      const stats = await getStats(db, route.id);
      return reply.code(200).send({ tenant, stats });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/me/branding',
    {
      preHandler: resolveTenant,
      schema: {
        body: BrandingUpdateSchema,
        response: { 200: TenantSchema, 401: ApiErrorSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const route = request.tenant!;
      const db = clientForTenant(route);
      const tenant = await updateBranding(db, route.id, request.body);
      return reply.code(200).send(tenant);
    },
  );
}

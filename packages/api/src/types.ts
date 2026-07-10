import 'fastify';
import type { TenantRoute } from '@invoice-saas/db';

// Augment FastifyRequest so the resolved tenant is typed wherever we read it.
declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantRoute;
  }
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveTenantBySlug } from '@invoice-saas/db';

/**
 * Resolves the calling tenant from the `x-tenant-slug` header and attaches it to
 * the request. Every protected route uses this preHandler, so tenant identity is
 * established once, at the edge, before any handler runs. This is the entry point
 * of the hybrid routing (ADR 0001).
 *
 * On failure we send and `hijack()` so Fastify does not also run the handler.
 */
export async function resolveTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const slug = request.headers['x-tenant-slug'];
  if (typeof slug !== 'string' || slug.length === 0) {
    await reply
      .code(401)
      .send({ error: 'unauthorized', message: 'missing x-tenant-slug header' });
    reply.hijack();
    return;
  }

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) {
    await reply
      .code(404)
      .send({ error: 'not_found', message: `tenant "${slug}" not found` });
    reply.hijack();
    return;
  }

  request.tenant = tenant;
}

import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Guards the admin endpoint (POST /admin/run-overdue) with a shared secret in the
 * `Authorization: Bearer <ADMIN_API_TOKEN>` header. Every request is rejected unless
 * it carries the exact token.
 *
 * SECURITY: if `ADMIN_API_TOKEN` is not configured, EVERY request is rejected (401).
 * There is deliberately NO "open when unset" fallback — an unauthenticated admin
 * sweep would let anyone flip invoices to overdue and trigger reminder emails. Set
 * the variable (see `.env.example`) before deploying or exercising this route.
 *
 * The token is compared in constant time to avoid timing side-channels.
 */
export async function requireAdminToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    await reply
      .code(401)
      .send({ error: 'unauthorized', message: 'admin endpoint not configured (set ADMIN_API_TOKEN)' });
    reply.hijack();
    return;
  }

  const header = request.headers['authorization'];
  const provided = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i)?.[1] : undefined;
  if (!provided) {
    await reply
      .code(401)
      .send({ error: 'unauthorized', message: 'missing or malformed Authorization header' });
    reply.hijack();
    return;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    await reply.code(401).send({ error: 'unauthorized', message: 'invalid admin token' });
    reply.hijack();
    return;
  }
}

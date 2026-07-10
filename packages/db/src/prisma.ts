import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client for the POOLED database.
 *
 * SILOED tenants get a dedicated client constructed on demand (see
 * `clientForTenant` in tenancy/registry.ts). Keep one client per connection
 * string — constructing many is a classic connection-leak mistake at scale.
 */
export const prisma = new PrismaClient();

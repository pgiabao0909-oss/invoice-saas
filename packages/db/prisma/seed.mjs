// Seed script for local dev (run with: npm run seed -w @invoice-saas/db).
// Requires a Postgres reachable via DATABASE_URL. Demonstrates one POOLED and
// one SILOED tenant (hybrid tenancy, ADR 0001).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pooled = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { name: 'Acme Co', slug: 'acme', dataMode: 'POOLED', baseCurrency: 'USD' },
  });

  const siloed = await prisma.tenant.upsert({
    where: { slug: 'globex' },
    update: {},
    create: {
      name: 'Globex', slug: 'globex', dataMode: 'SILOED',
      dataLocation: 'db://globex', baseCurrency: 'EUR',
    },
  });

  await prisma.client.upsert({
    where: { tenantId_email: { tenantId: pooled.id, email: 'bob@acme.test' } },
    update: {},
    create: { tenantId: pooled.id, legalName: 'Bob Buyer', email: 'bob@acme.test' },
  });

  console.log('Seeded tenants:', { pooled: pooled.id, siloed: siloed.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

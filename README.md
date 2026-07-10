# Invoice SaaS

An automated invoice generator built to scale enormously, with on-demand hard isolation
for individual ("siloed") tenants. See `CONTEXT.md` for the domain glossary and
`docs/adr/0001-stack-and-tenancy.md` for the architecture decision.

## Stack

- **TypeScript everywhere**, single source of truth for types via `packages/contracts`
  (Zod schemas validated at every boundary).
- Monorepo (npm workspaces): `contracts`, `db`, `api` (Fastify), `worker`, `web` (Next.js).
- **Postgres** with **hybrid tenancy**: pooled tenants (shared DB + Row-Level Security)
  and siloed tenants (own DB/schema) routed via a `tenants` registry.
- **Outbox + durable job queue** so async work (email, PDF, reminders, webhooks) never
  loses or duplicates an event.
- **Stripe** payments with idempotent webhook handling.

## Layout

```
packages/
  contracts/   shared Zod schemas + inferred TS types
  db/          Prisma schema, tenant registry, scoped data-access, outbox/jobs
  api/         Fastify HTTP server
  worker/      off-request-path job consumer
  web/         Next.js frontend shell
```

## Common commands

```
npm install                 # install all workspace deps
npm run typecheck           # tsc --noEmit across packages
npm run test                # vitest across packages
npm run prisma:validate     # validate the db schema
npm run prisma:generate     # generate the Prisma client
```

## Planning

- `CONTEXT.md` — domain glossary (ubiquitous language).
- `.scratch/mvp/PRD.md` — MVP slice spec.
- `tickets.md` + `.scratch/mvp/issues/01..05-*.md` — tracer-bullet tickets, triaged
  `ready-for-agent`. Frontier = `01-data-model-multitenant`.

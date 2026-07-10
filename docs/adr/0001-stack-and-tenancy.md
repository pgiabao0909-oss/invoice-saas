# ADR 0001 — Stack & tenancy model

- **Status:** Accepted (2026-07-10)
- **Context:** Invoice SaaS MVP must scale to a very large tenant count while allowing
  specific "individual" tenants (enterprise/regulated/loud neighbors) to be isolated on
  demand. We want a foundation that is mistake-resistant at scale.
- **Decision:** See below.
- **Consequences:** See below.

## Decision

### Language & typing (the primary "no-mistakes" lever)
**TypeScript everywhere**, with a single shared `contracts` package of **Zod** schemas
that are the one source of truth for domain types. The same schema produces both
runtime validation (at every system boundary) and compile-time types. A shape changed in
`contracts` breaks the build everywhere it's used — impossible to drift silently.

### Repository layout (npm workspaces)
```
packages/
  contracts/   Zod schemas + inferred types (shared)
  db/          Prisma schema, tenant registry, scoped data-access, outbox/jobs
  api/         Fastify HTTP server (stateless, horizontally scalable)
  worker/      Off-request-path job consumer (email, PDF, reminders, webhooks)
  web/         Next.js frontend shell
```
(pnpm workspaces are equivalent and preferred in production; npm workspaces used here to
match the local toolchain. Swap is config-only.)

### API
**Fastify** — stateless, fast, horizontally scalable behind a load balancer. Every route
input/output is validated by the shared Zod schemas (`@fastify/type-provider-zod`).

### Async work & the outbox (the primary "no-data-loss" lever)
Email, PDF generation, reminders, and Stripe webhook handling run in **`worker/` off the
request path**, driven by a **durable Postgres-backed job queue** (a `jobs` table +
transactional `outbox`). Because the job row is written in the *same transaction* as the
invoice change, there is no dual-write gap: an event is never lost and never duplicated.
No external queue/Redis required for correctness (Redis/BullMQ can be swapped in later
behind the same `JobQueue` interface if throughput demands it).

### Payments & idempotency
**Stripe** for payments. Every payment-affecting operation carries an **idempotency key**;
webhook handlers are idempotent, so retries never double-apply.

### Database & tenancy (Hybrid)
**Postgres + PgBouncer.** Tenancy is **hybrid**:

- A `tenants` registry table records each tenant's `dataMode`: `POOLED` (shares the main
  database) or `SILOED` (own database/schema). The app resolves the tenant on each request
  and routes to the correct data store.
- **Pooled** tenants share the main Postgres; safety is enforced by app-level `tenantId`
  scoping **and** a Postgres **Row-Level Security** policy as a defense-in-depth backstop.
- **Siloed** ("individual ones") tenants get a dedicated database/schema — hard isolation,
  clean blast radius — provisioned on demand.

This gives pooled economics for the long tail plus opt-in hard isolation where it matters.

### Observability
Structured logging + OpenTelemetry tracing from day one — you cannot scale what you cannot
see.

## Consequences

- **Good:** Type-safe boundaries prevent whole classes of integration bugs; outbox removes
  dual-write data-loss; idempotency makes retries safe; hybrid tenancy scales cheaply while
  isolating specific tenants.
- **Cost:** A tenant-routing layer exists (kept simple: `tenants` lookup → connection).
  Pooled tenants still get RLS as a backstop. Siloed tenants add provisioning/migration
  orchestration (a later ticket, not MVP).
- **Out of scope here:** Per-tenant DB provisioning automation, Redis/BullMQ swap, full
  Next.js feature build-out. These follow once the foundation is verified.

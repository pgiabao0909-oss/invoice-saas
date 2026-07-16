# Running the Invoice SaaS (API + Web UI)

> **UI:** the web app now follows the design system in `design-system/invoice-saas/MASTER.md`
> (navy `#1E3A5F` primary + green `#059669` CTA, Calistoga/Inter/JetBrains Mono fonts, Lucide
> icons). Page-level rules live in `design-system/pages/`.

This walks through running the backend API and the Next.js web UI locally against a
real Postgres. The web app talks to the API through a **same-origin rewrite** (the
browser only ever hits `http://localhost:3000`; Next proxies `/api/*` → `http://localhost:3001`),
so no CORS setup is required.

## 1. Prerequisites

- Node.js ≥ 20
- Docker (for Postgres) — or any Postgres 16 you can point `DATABASE_URL` at
- An [OpenRouter](https://openrouter.ai)-free setup is **not** needed; the app falls back
  to safe no-credential modes (fake Stripe link, console email) when keys are unset.

## 2. Start Postgres

```bash
docker compose up -d
```

This starts Postgres at `localhost:5432` (user `postgres`, db `invoicesaas`) matching the
`DATABASE_URL` in `.env.example`.

## 3. Configure environment

```bash
cp .env.example .env
```

Then open `.env` and set at least:

- `ADMIN_API_TOKEN` — a long random secret (`openssl rand -hex 32`). Required for the
  **Run overdue sweep** button in the dashboard; if unset, that endpoint rejects all
  requests by design.
- `DATABASE_URL` — already `postgresql://postgres:postgres@localhost:5432/invoicesaas`.
- Stripe / Resend keys are optional (the app runs without them).

## 4. Generate the Prisma client and create the schema

```bash
npm run prisma:generate
npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss
```

> The `--schema` path is required — `prisma db push -w @invoice-saas/db` does **not** work.
> (`prisma db push` creates the tables from `packages/db/prisma/schema.prisma`. Use
> `prisma migrate dev` instead if you want versioned migrations.)

## 5. Run the API and the web app

In two terminals:

```bash
# Terminal A — Fastify API on :3001
npm run dev:api            # equivalent to: PORT=3001 npm run dev -w @invoice-saas/api

# Terminal B — Next.js web UI on :3000
npm run dev -w @invoice-saas/web
```

Open **http://localhost:3000**.

## 6. First-run walkthrough

1. The app shows a **workspace onboarding** screen. Create a workspace (e.g. name
   `Acme Inc.`, slug `acme`). The slug becomes your `x-tenant-slug`.
2. You land on the **Dashboard** with KPI cards (Draft / Sent / Paid / Overdue /
   Outstanding) — all zero until you add data.
3. Go to **Clients → + New client** and add a billing recipient.
4. Go to **Invoices → + New invoice**: pick the client, set currency + due date, add
   line items (totals compute live), then **Create invoice**.
5. On the invoice detail page, click **Send invoice** — this transitions the invoice
   `draft → sent` and enqueues the branded PDF email job (logged by the worker / sent
   via Resend if configured).
6. Once an invoice is sent, a **Pay online** button appears (Stripe payment link).
7. **Settings** lets you set display name, logo, and primary color — these brand the
   invoice preview and (server-side) the PDF/email.

## 7. Overdue sweep (admin)

The dashboard's **Overdue** card has a **Run sweep** button. It calls
`POST /admin/run-overdue`, which requires an `Authorization: Bearer <ADMIN_API_TOKEN>`
header. The UI prompts for the token at click time. Each run flips past-due sent invoices
to `overdue` and enqueues reminder emails (+1 / +7 / +14 days).

## 8. Verify the build (no Postgres needed)

```bash
npm run typecheck     # all packages
npm run test          # unit tests (db + api + worker), in-memory fake Prisma
npm run build -w @invoice-saas/web   # next build
```

## Architecture notes

- **Tenancy** is hybrid (ADR 0001): every API request carries `x-tenant-slug`; the
  `resolveTenant` preHandler attaches the tenant before any handler runs.
- **Read endpoints added for the UI:** `GET /invoices`, `GET /invoices/:id`,
  `GET /clients`, `POST /clients`, `GET /tenants`, `POST /tenants`, `GET /me`,
  `PATCH /me/branding`. (The earlier sessions shipped the write endpoints:
  `POST /invoices`, `POST /invoices/:id/send`, `POST /admin/run-overdue`,
  `POST /webhooks/stripe`.)
- **Money** is always integer minor units (cents) end-to-end; totals use banker's
  rounding per line item (shared `computeTotals` in `@invoice-saas/contracts`).

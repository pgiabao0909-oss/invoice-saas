// Workflow: build the T3 + T4 frontier of the invoice SaaS (Matt Pocock TDD pipeline),
// then adversarially verify each. Orchestrated under ultracode effort.
//
// T3 — Stripe payment link at send + idempotent payment webhook -> paid.
// T4 — Overdue detection + day-1/7/14 reminder schedule.
//
// Pattern: each ticket is built test-first by one agent, then independently
// adversarially verified by a second agent. T4 runs only if T3 is green & unblocked.

export const meta = {
  name: 't3-t4-frontier',
  description:
    'Build T3 (Stripe payment link + idempotent webhook) and T4 (overdue reminders) test-first, then adversarially verify each.',
  phases: [
    { title: 'Build T3', detail: 'TDD: Stripe payment link + idempotent payment webhook' },
    { title: 'Verify T3', detail: 'Adversarial verification of T3 acceptance criteria' },
    { title: 'Build T4', detail: 'TDD: overdue detection + reminder schedule' },
    { title: 'Verify T4', detail: 'Adversarial verification of T4 acceptance criteria' },
  ],
};

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'array', items: { type: 'string' } },
    testCommand: { type: 'string' },
    testsPassed: { type: 'number' },
    testsFailed: { type: 'number' },
    typecheck: { type: 'string', enum: ['pass', 'fail', 'not-run'] },
    prismaValid: { type: 'string', enum: ['pass', 'fail', 'not-run'] },
    blocker: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['filesChanged', 'testsAdded', 'summary'],
};

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    acceptanceCriteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string' },
          met: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['criterion', 'met', 'evidence'],
      },
    },
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          description: { type: 'string' },
        },
        required: ['file', 'line', 'severity', 'description'],
      },
    },
    verdict: { type: 'string', enum: ['CONFIRMED', 'PLAUSIBLE', 'REJECTED'] },
    recommendation: { type: 'string' },
  },
  required: ['acceptanceCriteria', 'bugs', 'verdict', 'recommendation'],
};

const BUILD_T3_PROMPT = `You are implementing T3 of an invoice SaaS monorepo at C:\\Users\\BAO\\claude-project using a strict Test-Driven Development pipeline (Matt Pocock "full pipeline"). Write FAILING tests FIRST, then implement to make them pass, then keep typecheck + existing tests green. Do NOT commit — the orchestrator commits later.

REPO SHAPE (npm workspaces monorepo):
- packages/contracts — shared Zod schemas + inferred TS types (single source of truth).
- packages/db — Prisma client, domain logic (invoices, totals), tenancy guard, job queue/outbox.
- packages/api — Fastify 5 server, routes.
- packages/worker — job consumer (off request path), PDF + email.
- packages/web — Next.js shell (not relevant to T3).

FIRST, READ THESE to mirror existing conventions precisely (do not invent new patterns):
- packages/db/src/domain/invoices.ts  (markSent: outbox+job in one tx; INVOICE_NOT_FOUND / INVOICE_NOT_DRAFT errors)
- packages/db/src/domain/totals.ts
- packages/db/src/jobs/queue.ts  (PostgresJobQueue, claimNextJob SKIP LOCKED)
- packages/db/src/tenancy/scoped.ts  (TenantScoped guard), packages/db/src/tenancy/registry.ts (clientForTenant)
- packages/db/src/index.ts  (barrel exports)
- packages/db/prisma/schema.prisma  (Invoice has NO paymentLink yet — you will add it; Payment model EXISTS with @@unique([tenantId, idempotencyKey]))
- packages/worker/src/worker.ts  (EMAIL_INVOICE handler), packages/worker/src/email.ts  (EmailSender seam: ConsoleEmailSender + createEmailSender factory falling back to console when env unset)
- packages/worker/src/pdf.ts
- packages/api/src/routes/invoices.ts  (resolveTenant preHandler; 404/409 mapping), packages/api/src/plugins/tenant.ts, packages/api/src/server.ts
- packages/contracts/src/index.ts  (PaymentSchema, Money, IdempotencyKey, InvoiceSchema)
- Existing tests: packages/db/src/__tests__/mark-sent.test.ts, scoping.test.ts, totals.test.ts AND packages/worker/src/__tests__/pdf.test.ts — READ to learn how tests run (real DB vs mock) and how test data is set up.
- packages/db/vitest.config.ts and packages/worker/vitest.config.ts.

ESTABLISH BASELINE before writing code: run \`npm run test -w @invoice-saas/db\` (and worker) to confirm the suite runs in THIS environment. The previous session reported 11 passing tests against a real Postgres. If the DB is unreachable, attempt to start a local Postgres (docker / pg_ctl / \`npx prisma db push\` against a placeholder DATABASE_URL) OR report a clear blocker — do NOT silently skip tests or fake results. Document the DATABASE_URL you used.

T3 ACCEPTANCE CRITERIA (from .scratch/mvp/issues/04-stripe-payment-webhook.md):
1. A Stripe payment link is created at send time and included in the client email.
2. Webhook records a Payment against the invoice with an idempotency key; retries never double-apply.
3. Invoice transitions sent -> paid when amount_paid >= amount_due; partial payments tracked.
4. Illegal transitions (e.g. paid -> draft) are rejected.

DESIGN (follow the EmailSender seam pattern — inject a provider so tests need NO Stripe keys):

A) New file packages/db/src/integrations/stripe.ts:
   - interface PaymentProvider {
       createPaymentLink(input: { invoiceId: string; tenantId: string; amountMinor: number; currency: string; description: string }): Promise<{ url: string }>;
       verifyWebhookSignature(rawBody: string, signature: string): boolean;
       parseEvent(rawBody: string): { type: string; eventId: string; invoiceId: string; amountMinor: number; currency: string; idempotencyKey: string };
     }
   - class StripePaymentProvider implements PaymentProvider — uses fetch (NO SDK). createPaymentLink POSTs to the Stripe Payment Links API with invoice id in metadata; verifyWebhookSignature validates the Stripe-Signature HMAC via Node crypto; parseEvent JSON.parses and reads metadata.invoiceId.
   - class FakePaymentProvider implements PaymentProvider — for tests: createPaymentLink returns \`https://pay.test/invoice/{invoiceId}\` and COUNTS calls (expose a public callCount) so idempotency is verifiable; verifyWebhookSignature returns true; parseEvent returns a canned event (or builds one from args).
   - function createPaymentProvider(): PaymentProvider — returns Fake when STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are unset (mirrors createEmailSender), else StripePaymentProvider.
   - Export these from packages/db/src/index.ts barrel.

B) Schema change: add \`paymentLink String?\` to the Invoice model in packages/db/prisma/schema.prisma. After editing, run \`npm run prisma:generate\` (DATABASE_URL must be set — a placeholder is fine).

C) New file packages/db/src/domain/payments.ts:
   - ensurePaymentLink(provider, prisma, tenantId, invoice): in a tx, load invoice scoped by tenant; if missing throw INVOICE_NOT_FOUND; if invoice.paymentLink already set, return it WITHOUT calling provider again (idempotent); else call provider.createPaymentLink, persist to invoice.paymentLink, return url.
   - recordPayment(prisma, tenantId, invoiceId, { amountMinor, currency, idempotencyKey, stripeChargeId? }): in a tx —
       * load invoice scoped by tenant; if missing throw INVOICE_NOT_FOUND;
       * IDEMPOTENCY: if a Payment with (tenantId, idempotencyKey) already exists, return the current invoice state (no-op, no double-apply). The unique constraint is the backstop.
       * ILLEGAL TRANSITIONS: only allow recording from status 'sent' or 'overdue'. If status is 'draft' or 'void', throw ILLEGAL_TRANSITION. A different idempotencyKey arriving for an already-'paid' invoice must also be rejected (throw ILLEGAL_TRANSITION or ALREADY_PAID) — it must NOT add more money.
       * create Payment (amountMinor, currency, idempotencyKey, stripeChargeId).
       * add amountMinor to amountPaidMinor.
       * if amountPaidMinor >= totalMinor -> status 'paid'.
       * return updated Invoice (same mapInvoice shape as invoices.ts).
   - Export from barrel.

D) contracts: add \`paymentLink: z.string().url().optional()\` to InvoiceSchema (so the API response includes it). Keep PaymentSchema as-is.

E) API — new file packages/api/src/routes/webhooks.ts:
   - POST /webhooks/stripe. Capture the RAW body + stripe-signature header. Verify via PaymentProvider.verifyWebhookSignature. On a payment success event, extract invoiceId from event metadata, then call recordPayment with amountMinor/currency/idempotencyKey from the event. Return 200 {received:true}. Return 200 for unhandled event types (Stripe needs 2xx). Return 400 on signature failure. Register the route in server.ts WITHOUT resolveTenant (tenant comes from event metadata, not header).
   - If packages/api has no vitest config, you MAY add one + an __tests__/webhook.test.ts using fastify.inject; otherwise unit-test the provider + recordPayment in the db suite (prefer matching the existing harness). Document your choice.

F) Worker — extend the EMAIL_INVOICE handler in packages/worker/src/worker.ts:
   - After rendering the PDF, call ensurePaymentLink(provider, prisma, tenantId, invoice) to obtain the link (idempotent), and include it in the email body, e.g. "Pay online: <url>". Use createPaymentProvider() in the worker module (mirror createEmailSender()).

TESTS (write FIRST, watch them fail, then implement):
- packages/db/src/__tests__/payments.test.ts:
   1. recordPayment idempotency: same idempotencyKey twice -> only one Payment row; amountPaidMinor not doubled; (tenantId,idempotencyKey) unique is the backstop (your code must short-circuit BEFORE the second create).
   2. partial payment: amountMinor < totalMinor -> status stays 'sent', amountPaidMinor == partial.
   3. full payment: amountMinor >= totalMinor -> status 'paid'.
   4. illegal transition: recordPayment on a 'draft' invoice -> throws ILLEGAL_TRANSITION; on a 'void' invoice -> throws ILLEGAL_TRANSITION.
   5. ensurePaymentLink idempotency: createInvoice -> markSent (draft->sent) -> call ensurePaymentLink twice -> provider.createPaymentLink called EXACTLY once; invoice.paymentLink persisted & returned.
   Use the SAME DB-backed test style as mark-sent.test.ts / scoping.test.ts (read them!). Create tenants/clients/invoices as those tests do.
- Provider test packages/db/src/__tests__/stripe.test.ts:
   * FakePaymentProvider.createPaymentLink returns a deterministic url and increments callCount; a second ensurePaymentLink does not call again (covered above).
   * StripePaymentProvider.verifyWebhookSignature / parseEvent: test with a known HMAC fixture OR guard with \`if (!process.env.STRIPE_WEBHOOK_SECRET) return;\` so it never fails when keys are absent.
- Worker: add a test (worker vitest) that an INVOICE_EMAIL job sends an email whose body CONTAINS the payment link. Mirror packages/worker/src/__tests__/pdf.test.ts style.

VERIFY BEFORE RETURNING:
- \`npm run prisma:generate\`
- \`npm run prisma:validate\` (DATABASE_URL placeholder is fine; it does NOT connect)
- \`npm run test -w @invoice-saas/db\`, \`npm run test -w @invoice-saas/worker\`, any api tests — ALL must pass
- \`npm run typecheck\` (tsc --noEmit across workspaces) — must be clean
- Confirm the 11 pre-existing tests still pass (you ADDED to them, didn't break them)

RETURN (StructuredOutput) JSON matching the build schema: filesChanged, testsAdded, testCommand, testsPassed, testsFailed, typecheck, prismaValid, blocker ('' if none), summary. Be HONEST about any blocker (e.g., DB unavailable) — never claim green when you couldn't run.`;

const VERIFY_T3_PROMPT = `You are ADVERSARIALLY verifying the T3 implementation just produced by another agent in the invoice SaaS monorepo at C:\\Users\\BAO\\claude-project. Your job is INDEPENDENT verification — assume the implementing agent may have cut corners.

DO:
- Run the test suites YOURSELF: \`npm run test -w @invoice-saas/db\`, \`npm run test -w @invoice-saas/worker\`, any api tests. Record pass/fail counts.
- Run \`npm run typecheck\` and \`npm run prisma:validate\`.
- Read the new/changed code: packages/db/src/domain/payments.ts, packages/db/src/integrations/stripe.ts, packages/api/src/routes/webhooks.ts, the worker EMAIL_INVOICE handler, schema.prisma (paymentLink), contracts InvoiceSchema, and the test files.
- For EACH T3 acceptance criterion, judge met/plausible/not-met with concrete evidence (file:line or a test name):
  1. Payment link created at send time & in client email — is ensurePaymentLink called in the worker EMAIL_INVOICE path, and is the link placed in the email body?
  2. Webhook idempotency — does recordPayment short-circuit on (tenantId,idempotencyKey)? Is there a test proving a retry doesn't double-apply? Is the unique constraint present as backstop?
  3. sent->paid on full payment; partial tracked — is status set 'paid' only when amountPaid>=total; is amountPaidMinor summed; does a partial leave it 'sent'?
  4. Illegal transitions rejected — is recordPayment on 'draft'/'void' rejected; is paid->draft impossible; is a second payment for an already-paid invoice rejected?
- ADVERSARIALLY hunt bugs:
  * Race condition in idempotency: two concurrent identical webhooks both passing the exists-check before insert — is the unique constraint the REAL guarantee, or does the code rely solely on a read check (TOCTOU)?
  * Tenant scoping: can a webhook for tenant A credit tenant B's invoice? idempotencyKey is scoped by tenantId — verify the lookup uses tenantId, not just the key.
  * Webhook signature bypass: does the route actually verify BEFORE processing? Does it return 2xx on verify failure (which would let attackers post fake payments)?
  * Payment link leakage across tenants; amount/cent handling (integer minor units, no float); stripeChargeId stored.
  List each finding with file:line, severity (critical/high/medium/low), and a fix suggestion.

RETURN StructuredOutput matching verify schema: acceptanceCriteria[] (criterion, met, evidence), bugs[] (file, line, severity, description), verdict (CONFIRMED/PLAUSIBLE/REJECTED), recommendation.`;

const BUILD_T4_PROMPT = `You are implementing T4 of an invoice SaaS monorepo at C:\\Users\\BAO\\claude-project using strict TDD (Matt Pocock "full pipeline"). T3 is already merged into the working tree. Write FAILING tests FIRST, then implement. Do NOT commit.

REPO SHAPE & CONVENTIONS: same as T3. READ packages/db/src/domain/invoices.ts, packages/db/src/domain/payments.ts, packages/db/src/jobs/queue.ts, packages/db/src/tenancy/*, packages/db/src/index.ts, packages/db/prisma/schema.prisma, packages/worker/src/worker.ts (note the TODO(T4) INVOICE_OVERDUE case), packages/worker/src/email.ts, packages/api/src/routes/*, packages/api/src/server.ts, packages/contracts/src/index.ts, and the existing tests (mark-sent.test.ts, scoping.test.ts, totals.test.ts, payments.test.ts, stripe.test.ts, pdf.test.ts) + vitest configs.

ESTABLISH BASELINE: run \`npm run test -w @invoice-saas/db\` and worker to confirm green before adding code. Use the same DATABASE_URL as T3.

T4 ACCEPTANCE CRITERIA (tickets.md T4):
1. A scheduled check flips sent -> overdue when due date passes and balance remains.
2. Reminder emails go out on day-1 / day-7 / day-14 after due.
3. No reminders for paid or void invoices.
4. Overdue transition and reminders are tenant-scoped.

DESIGN:
- New file packages/db/src/domain/overdue.ts:
  - detectOverdue(prisma, asOf: Date): scan invoices where status=='sent' AND dueDate < asOf AND amountPaidMinor < totalMinor, scoped by tenantId. For each, in a tx: set status='overdue', enqueue 3 reminder jobs (type INVOICE_REMINDER, payload {invoiceId, tenantId, reminderIndex}) with availableAt = dueDate + 1d / +7d / +14d (use prisma.job.create like queue.ts, or a JobEnqueuer). Do NOT touch 'paid' or 'void'.
- Worker: implement handling of INVOICE_REMINDER jobs (replacing/extending the TODO(T4) INVOICE_OVERDUE case): load invoice+client, send reminder email via EmailSender (body like "Invoice {number} is overdue — please pay"). Idempotent by job completion (claimNextJob + completeJob already guarantee once).
- Scheduler trigger: add a runnable entry. Simplest: a new script packages/worker/src/overdue-check.ts that calls detectOverdue(prisma, new Date()), PLUS an API route \`POST /admin/run-overdue\` (guarded; note lack of auth for MVP) that calls detectOverdue. Document your choice.
- contracts: add a response schema for the overdue-check route if you add it.

TESTS (first, then implement) packages/db/src/__tests__/overdue.test.ts:
  1. sent invoice past due with balance -> status 'overdue'; 3 INVOICE_REMINDER jobs enqueued with availableAt offsets 1/7/14 days.
  2. paid invoice past due -> unchanged (no jobs).
  3. void invoice past due -> unchanged.
  4. sent invoice past due but amountPaidMinor>=totalMinor -> stays 'sent' (no jobs).
  5. tenant scoping: tenant A's detectOverdue does NOT flip tenant B's invoice; a reminder job for tenant A emails only tenant A's client.
- Worker reminder test: an INVOICE_REMINDER job sends an email to the client.

VERIFY BEFORE RETURNING:
- \`npm run prisma:generate\`, \`npm run prisma:validate\`
- \`npm run test -w @invoice-saas/db\`, worker, any api tests — ALL pass
- \`npm run typecheck\` clean
- Confirm T3 tests (payments.test.ts, stripe.test.ts) STILL pass.

RETURN StructuredOutput JSON matching the build schema: filesChanged, testsAdded, testCommand, testsPassed, testsFailed, typecheck, prismaValid, blocker ('' if none), summary. Be HONEST about blockers.`;

const VERIFY_T4_PROMPT = `You are ADVERSARIALLY verifying the T4 implementation (overdue detection + reminders) in the invoice SaaS monorepo at C:\\Users\\BAO\\claude-project. Independent verification; assume corners may have been cut.

DO:
- Run \`npm run test -w @invoice-saas/db\`, worker, api tests; record counts. Run \`npm run typecheck\` and \`npm run prisma:validate\`.
- Read packages/db/src/domain/overdue.ts, packages/worker/src/worker.ts (INVOICE_REMINDER handler), the overdue-check entry, schema.prisma, and the tests.
- For EACH T4 acceptance criterion, judge met/plausible/not-met with evidence:
  1. sent->overdue when due passes & balance remains.
  2. Reminders at day 1/7/14 after due (3 jobs with correct availableAt offsets).
  3. No reminders for paid/void invoices.
  4. Tenant-scoped transition & reminders (tenant A's check doesn't flip/email tenant B).
- ADVERSARIALLY hunt bugs:
  * Double-flip: if detectOverdue runs twice, does it re-enqueue 3 jobs each time (duplicate reminders)? Is the status guard ('sent' only) the protection, and is it reliable under a re-run?
  * Date math: are offsets exactly +1/+7/+14 days; timezone/DST issues with Date arithmetic?
  * Tenant scoping in the query (tenantId in WHERE) and in the worker (job payload tenantId used for lookup, not trusted invoice id alone).
  * Reminder email sent even after invoice becomes paid in the interim (stale job) — is there a freshness check?
  List findings with file:line, severity, fix suggestion.

RETURN StructuredOutput matching verify schema: acceptanceCriteria[] (criterion, met, evidence), bugs[] (file, line, severity, description), verdict (CONFIRMED/PLAUSIBLE/REJECTED), recommendation.`;

// ---- orchestration --------------------------------------------------------

log('Starting T3 build (test-first)');
const t3 = await agent(BUILD_T3_PROMPT, {
  label: 'build T3',
  phase: 'Build T3',
  schema: BUILD_SCHEMA,
  effort: 'high',
});
log(`T3 build done. passed=${t3.testsPassed} failed=${t3.testsFailed} typecheck=${t3.typecheck} blocker="${t3.blocker}"`);

log('Adversarially verifying T3');
const t3v = await agent(VERIFY_T3_PROMPT, {
  label: 'verify T3',
  phase: 'Verify T3',
  schema: VERIFY_SCHEMA,
  effort: 'xhigh',
});
log(`T3 verdict=${t3v.verdict} bugs=${t3v.bugs.length}`);

const t3Green = !t3.blocker && t3.typecheck === 'pass' && t3.testsFailed === 0;

if (!t3Green) {
  log('T3 not green — skipping T4 to avoid cascading failure. Fix T3 first.');
  return { t3, t3v, t4: null, t4v: null, skipped: 'T4 (T3 not green)' };
}

log('T3 green — starting T4 build (test-first)');
const t4 = await agent(BUILD_T4_PROMPT, {
  label: 'build T4',
  phase: 'Build T4',
  schema: BUILD_SCHEMA,
  effort: 'high',
});
log(`T4 build done. passed=${t4.testsPassed} failed=${t4.testsFailed} typecheck=${t4.typecheck} blocker="${t4.blocker}"`);

log('Adversarially verifying T4');
const t4v = await agent(VERIFY_T4_PROMPT, {
  label: 'verify T4',
  phase: 'Verify T4',
  schema: VERIFY_SCHEMA,
  effort: 'xhigh',
});
log(`T4 verdict=${t4v.verdict} bugs=${t4v.bugs.length}`);

return { t3, t3v, t4, t4v };

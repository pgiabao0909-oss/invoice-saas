Status: ready-for-agent
Type: task
Category: enhancement
Blocked by: 03-pdf-email-send
Source: tickets.md T3; PRD `.scratch/mvp/PRD.md`; glossary `CONTEXT.md`

# T3 — Stripe payment link + idempotent payment webhook

**What to build:** When an invoice is sent, a Stripe-hosted payment link is included so
the client can pay online. A webhook records the Payment idempotently and moves the
invoice to `paid`, handling partial payments and ignoring duplicate deliveries.

**Acceptance criteria**

- [ ] A Stripe payment link is created at send time and included in the client email.
- [ ] Webhook records a Payment against the invoice with an idempotency key; retries never double-apply.
- [ ] Invoice transitions `sent → paid` when `amount_paid >= amount_due`; partial payments tracked.
- [ ] Illegal transitions (e.g. `paid → draft`) are rejected.

## Comments

# PRD: Invoice SaaS — MVP slice

> Source spec for `/to-tickets`. Stack is intentionally deferred (see Open Questions in
> CONTEXT.md); this document specifies product behaviour, not implementation. Suggested
> stack on record: TypeScript + Next.js + Postgres + Stripe.

## Goal

Ship the smallest vertical slice that lets a tenant create an invoice, deliver it to a
client, get paid online, and be reminded automatically when overdue.

The MVP value path, end to end:

**create invoice → generate PDF → email it → Stripe payment link → auto-reminders on overdue**

## Non-goals (this slice)

- Recurring schedules (modeled in CONTEXT.md, not built)
- FX / multi-currency conversion
- Full per-jurisdiction tax-compliance engine
- Per-tenant custom email domains
- Credit notes / refunds (tracked for a later slice)

## User stories

### US-1: Create a draft invoice
As a tenant user, I can create a draft invoice for an existing client with line items
(description, quantity, unit price), choose a currency, and set a due date. The invoice
saves in `draft` state and shows correct subtotal, tax, discount, and total.

### US-2: Generate a PDF
As a tenant user, I can generate a downloadable, branded PDF for a draft invoice. The
PDF reflects all line items, tax, discount, total, and tenant branding/logo.

### US-3: Email the invoice
As a tenant user, I can email the generated PDF to the client. On send, the invoice
moves to `sent` state and the client receives a message with the PDF attached (and a
payment link).

### US-4: Attach a Stripe payment link
As a tenant user, when I send an invoice I include a Stripe-hosted payment link so the
client can pay online. Payment is recorded against the invoice via webhook.

### US-5: Mark paid via webhook
As the system, when Stripe reports a successful payment for an invoice, I record a
Payment (idempotently), update `amount_paid`, and transition the invoice to `paid`.
Retries must never double-apply.

### US-6: Auto-remind on overdue
As the system, when a `sent` invoice passes its due date with an outstanding balance, I
transition it to `overdue` and send a reminder email to the client on a simple schedule
(e.g. day 1, day 7, day 14 after due).

## Acceptance criteria (whole slice)

- [ ] A tenant can complete US-1 → US-3 and the client receives a correct PDF by email.
- [ ] A client can pay via the Stripe link and the invoice reaches `paid` exactly once.
- [ ] An unpaid invoice past due flips to `overdue` and receives at least one reminder.
- [ ] A tenant cannot read or affect another tenant's invoices (multi-tenancy enforced).
- [ ] All money math uses integer minor units; tax is rounded per line (banker's rounding).

## Domain constraints (from CONTEXT.md)

- Every table carries `tenant_id`; all queries tenant-scoped.
- Invoice state machine: `draft → sent → paid | overdue → void`.
- Payment-affecting operations carry idempotency keys.
- Invoice number sequence decision (per-tenant vs global) is an Open Question — pick a
  safe default (per-tenant) for MVP and note it.

## Suggested ticket seams (for /to-tickets to refine)

1. Tenant + Client + Invoice data model & multi-tenant scoping
2. Create-invoice flow (draft, line items, totals, tax rounding)
3. PDF generation + branding
4. Email delivery + send transition
5. Stripe payment link + webhook + idempotent payment recording
6. Overdue detection + reminder schedule

## Open Questions to resolve before build

- Stack choice (deferred by user: planning-only for now).
- Invoice number sequence: per-tenant default assumed.
- Reminder schedule specifics (intervals above are a starting point).

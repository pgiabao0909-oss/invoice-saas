# Tickets: Invoice SaaS MVP slice

End-to-end vertical slices that take the product from zero to "create → PDF → email →
Stripe pay → auto-remind". Built on `CONTEXT.md` (domain glossary) and `.scratch/mvp/PRD.md`.
Stack is deferred (planning-only); tickets specify behaviour, not implementation.

Work the **frontier**: any ticket whose blockers are all done. Graph:
`T0 → T1 → T2 → {T3, T4}`. Top-to-bottom for the linear chain; T3 and T4 unblock
together once T2 lands.

**Triage (via `/triage`):** all five tickets are fully-specified tracer bullets, so each
is labeled `ready-for-agent` and filed as an individual issue under
`.scratch/mvp/issues/NN-<slug>.md`. Frontier = `01-data-model-multitenant` (no blockers).

| Ticket | Issue file | Status |
| ------ | ---------- | ------ |
| T0 | `.scratch/mvp/issues/01-data-model-multitenant.md` | ready-for-agent |
| T1 | `.scratch/mvp/issues/02-create-draft-invoice.md` | ready-for-agent |
| T2 | `.scratch/mvp/issues/03-pdf-email-send.md` | ready-for-agent |
| T3 | `.scratch/mvp/issues/04-stripe-payment-webhook.md` | ready-for-agent |
| T4 | `.scratch/mvp/issues/05-overdue-reminders.md` | ready-for-agent |

## T0 — Data model & multi-tenant foundation

**What to build:** A tenant-scoped data layer where every business table carries a
`tenant_id` and all access is scoped by it, so one tenant can never read another's data.
Covers Tenant, Client, Invoice, LineItem, TaxRate, Discount, and Payment.

**Blocked by:** None — can start immediately.

- [ ] Schema defines Tenant, Client, Invoice, LineItem, TaxRate, Discount, Payment with `tenant_id` on every business table.
- [ ] Tenant-scoped query helper exists and every read/write path is constrained by `tenant_id`.
- [ ] Migration/seed runs cleanly and a tenant cannot access another tenant's rows (verified by test).
- [ ] Monetary columns stored as integer minor units (cents), never float.

## T1 — Create draft invoice

**What to build:** A tenant user can create a client and a draft invoice with line items
(description, quantity, unit price), choose a currency, and set a due date. The invoice
saves in `draft` and shows correct subtotal, per-line tax, discount, and total.

**Blocked by:** T0 — Data model & multi-tenant foundation.

- [ ] API + minimal UI to create a Client and a draft Invoice with LineItems.
- [ ] Totals computed in integer minor units; tax rounded per line using banker's rounding.
- [ ] Invoice persists in `draft` state with correct subtotal/tax/discount/total.
- [ ] Invoice number uses a safe per-tenant default sequence (noted as an Open Question in CONTEXT.md).

## T2 — Generate branded PDF + email on send

**What to build:** A tenant user can generate a branded PDF of a draft invoice and email
it to the client. On send the invoice moves to `sent` and the client receives the PDF
with a payment pointer.

**Blocked by:** T1 — Create draft invoice.

- [ ] PDF renders all line items, tax, discount, total, and tenant branding/logo.
- [ ] Email delivers the PDF to the client's address.
- [ ] Sending transitions the invoice `draft → sent` and is rejected once already sent.
- [ ] Branding is tenant-configurable (logo/name at minimum).

## T3 — Stripe payment link + idempotent payment webhook

**What to build:** When an invoice is sent, a Stripe-hosted payment link is included so
the client can pay online. A webhook records the Payment idempotently and moves the
invoice to `paid`, handling partial payments and ignoring duplicate deliveries.

**Blocked by:** T2 — Generate branded PDF + email on send.

- [ ] A Stripe payment link is created at send time and included in the client email.
- [ ] Webhook records a Payment against the invoice with an idempotency key; retries never double-apply.
- [ ] Invoice transitions `sent → paid` when `amount_paid >= amount_due`; partial payments tracked.
- [ ] Illegal transitions (e.g. `paid → draft`) are rejected.

## T4 — Overdue detection + reminder schedule

**What to build:** The system detects `sent` invoices that passed their due date with an
outstanding balance, flips them to `overdue`, and emails reminders to the client on a
simple schedule.

**Blocked by:** T2 — Generate branded PDF + email on send.

- [ ] A scheduled check flips `sent → overdue` when due date passes and balance remains.
- [ ] Reminder emails go out on a day-1 / day-7 / day-14-after-due schedule.
- [ ] No reminders sent for `paid` or `void` invoices.
- [ ] Overdue transition and reminders are tenant-scoped.

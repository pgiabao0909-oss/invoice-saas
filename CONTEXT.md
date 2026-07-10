# CONTEXT.md — Invoice SaaS domain glossary

Single source of truth for the invoice SaaS domain language. Every term here is a
binding definition; code, tickets, and docs must use these words exactly. When a term
is ambiguous, update this file first, then propagate.

## Core entities

### Tenant
A single account/organization that owns invoices, clients, and configuration. Every
business table carries a `tenant_id` — multi-tenancy is a day-one constraint, not a
later migration. A tenant scopes visibility, branding, tax defaults, and currency.

### Client
A billing recipient belonging to a tenant. Has a legal name, billing address, email,
and tax identifier (e.g. VAT/EIN). Clients are reusable across many invoices.

### Invoice
The central document requesting payment from a client for a set of line items. Has a
lifecycle (see Invoice lifecycle below), an issue date, a due date, currency, and a
totals rollup. Always belongs to exactly one tenant and one client.

### LineItem
A single charge within an invoice: description, quantity, unit price, and optional
per-item tax/discount. Line items never exist outside an invoice.

### TaxRate
A percentage rate applied to line items or the invoice subtotal. Has a jurisdiction
scope (country/region) and a code (e.g. `VAT-GB`, `US-SALESTAX-CA`). Rounding rules
are defined separately (see Tax rounding).

### Discount
A reduction applied before or after tax. May be a fixed amount or a percentage, scoped
to the whole invoice or a single line item.

### Payment
A recorded inflow of money against an invoice. May be partial or full. Links to a
Stripe charge/checkout session and carries an idempotency key. Supports refunds and
reversals.

### CreditNote
A negative document issued against a paid (or partially paid) invoice to refund or
write off value. Reduces the client's outstanding balance; may be applied to future
invoices.

### Currency
An ISO 4217 code (e.g. `USD`, `EUR`, `GBP`) on the invoice. All monetary math is in
minor units (integer cents) to avoid float drift. FX conversion between tenant base
currency and invoice currency is out of MVP scope.

### RecurringSchedule
Optional rule that regenerates a draft invoice on an interval (e.g. monthly) from a
template. MVP may defer this; the model leaves room for it.

## Invoice lifecycle (state machine)

`draft → sent → paid | overdue → void`
`paid → (credit note issued) → refunded` (partial)

- **draft** — editable; not yet delivered. Totals may change.
- **sent** — delivered to client (PDF + email). No line-item edits; only corrective
  documents (credit notes) after this point.
- **paid** — full amount received. Terminal happy state.
- **overdue** — due date passed with outstanding balance. Triggers reminders.
- **void** — cancelled; legally null. No money expected.

State transitions are guarded; illegal transitions (e.g. `paid → draft`) are rejected.

## Tricky domain rules

### Tax rounding
Tax is computed per line item in minor units using banker's rounding (round-half-even),
then summed. Never round the subtotal's tax from the aggregate — round per line to
match jurisdiction expectations and avoid penny drift.

### Partial payments
An invoice may be paid in multiple installments. `amount_paid` tracks the running sum;
`status` becomes `paid` only when `amount_paid >= amount_due`. Overpayments create a
credit balance usable as a CreditNote.

### Credit notes
Issued for refunds/voids. A credit note references the source invoice, carries its own
number sequence, and reduces outstanding or creates forward credit.

### Recurring schedules
Template + interval → auto-generated draft each cycle. Must not double-charge if a run
fails; idempotent by schedule+period key.

## Cross-cutting invariants

- **Multi-tenancy (hybrid, see ADR 0001)**: every query is tenant-scoped via `tenantId`.
  Tenants are either `POOLED` (share the main Postgres, guarded by Row-Level Security) or
  `SILOED` (own database/schema — the "individual ones" that need hard isolation).
  A `tenants` registry routes each request to the correct data store. A tenant can never
  read another tenant's data (enforced at the data layer, with RLS as a backstop).
- **Idempotency**: all payment-affecting operations carry an idempotency key so webhook
  retries never double-apply.
- **Auditability**: invoice state transitions and payment events are append-only logged.

## Out of MVP scope (explicit non-goals for the first slice)

- FX / multi-currency conversion
- Recurring schedules (modeled, not built)
- Per-jurisdiction full tax-compliance engine (start with VAT% + simple sales tax)

## Open questions (resolve before build)

- Tenant base currency fixed at signup, or per-invoice selectable? (Affects FX scope.)
- Invoice number sequence: per-tenant or global? (Legal requirement varies by country.)
- Email delivery: shared sender domain or per-tenant custom domain from day one?

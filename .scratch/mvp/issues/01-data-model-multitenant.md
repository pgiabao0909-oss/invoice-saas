Status: ready-for-agent
Type: task
Category: enhancement
Blocked by: None — can start immediately
Source: tickets.md T0; PRD `.scratch/mvp/PRD.md`; glossary `CONTEXT.md`

# T0 — Data model & multi-tenant foundation

**What to build:** A tenant-scoped data layer where every business table carries a
`tenant_id` and all access is scoped by it, so one tenant can never read another's data.
Covers Tenant, Client, Invoice, LineItem, TaxRate, Discount, and Payment.

**Acceptance criteria**

- [ ] Schema defines Tenant, Client, Invoice, LineItem, TaxRate, Discount, Payment with `tenant_id` on every business table.
- [ ] Tenant-scoped query helper exists and every read/write path is constrained by `tenant_id`.
- [ ] Migration/seed runs cleanly and a tenant cannot access another tenant's rows (verified by test).
- [ ] Monetary columns stored as integer minor units (cents), never float.

## Comments

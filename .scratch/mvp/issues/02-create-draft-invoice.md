Status: ready-for-agent
Type: task
Category: enhancement
Blocked by: 01-data-model-multitenant
Source: tickets.md T1; PRD `.scratch/mvp/PRD.md`; glossary `CONTEXT.md`

# T1 — Create draft invoice

**What to build:** A tenant user can create a client and a draft invoice with line items
(description, quantity, unit price), choose a currency, and set a due date. The invoice
saves in `draft` and shows correct subtotal, per-line tax, discount, and total.

**Acceptance criteria**

- [ ] API + minimal UI to create a Client and a draft Invoice with LineItems.
- [ ] Totals computed in integer minor units; tax rounded per line using banker's rounding.
- [ ] Invoice persists in `draft` state with correct subtotal/tax/discount/total.
- [ ] Invoice number uses a safe per-tenant default sequence (noted as an Open Question in CONTEXT.md).

## Comments

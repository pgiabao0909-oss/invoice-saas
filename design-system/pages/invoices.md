# Page: Invoices (list)

> Overrides `design-system/invoice-saas/MASTER.md` where noted.

**Route:** `/invoices` (`app/invoices/page.tsx`)

**Applied rules**
- Page root carries `.page-enter` (280ms fade+rise, respects `prefers-reduced-motion`).
- Page title is an `<h1>` → rendered in **Calistoga** via the global heading rule.
- Filter uses the tokenized `Select` (rounded-lg, navy focus ring) — no custom styling.
- List rows render via `components/InvoiceTable.tsx` (white card, `border-surface-border`,
  `shadow-card`, `hover:bg-slate-50/60` row hover). Invoice-number links use
  `hover:text-brand-600` (navy).
- Empty state uses `EmptyState` (dashed `surface-border`).

**Icons:** none required on this page (filter is a native select).

**Notes**
- Status filter values map 1:1 to `InvoiceStatus` (draft/sent/paid/overdue/void); the
  `All` option is the empty string.

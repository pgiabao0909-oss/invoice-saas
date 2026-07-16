# Page: New invoice

> Overrides `design-system/invoice-saas/MASTER.md` where noted.

**Route:** `/invoices/new` (`app/invoices/new/page.tsx`)

**Applied rules**
- Root: `.page-enter mx-auto max-w-3xl`.
- Composed from tokenized components: `PageHeader`, `Card`/`CardBody`, `Field`/`Input`/
  `MoneyInput`, `Select`, `Modal`, `LineItemEditor`, `Button`.
- Primary CTA "Create invoice" = `Button` **primary** → solid `bg-accent-600` (paid-green),
  `shadow-md`, calm `-translate-y-px` hover. "New" client = `Button` **secondary** (navy outline).
- Inline client creation uses `Modal` (Lucide `X` close, `backdrop-blur` overlay, `shadow-xl`).
- Line items edited via `LineItemEditor` — remove button is a Lucide `X` icon (no `✕` emoji),
  `cursor-pointer`, `hover:bg-red-50 hover:text-danger`.
- Totals section (subtotal / discount / total) uses `font-mono` tabular figures via the
  `.nums` utility.
- Error banner: `bg-red-50 text-danger` (was `rose-*`).

**Icons:** `X` (LineItemEditor remove, Modal close) — Lucide.

**Anti-pattern compliance:** no emojis, all clickables have `cursor:pointer`, 200ms transitions,
focus-visible navy ring, `prefers-reduced-motion` honored globally.

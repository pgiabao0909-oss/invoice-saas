# Page: Invoice detail

> Overrides `design-system/invoice-saas/MASTER.md` where noted.

**Route:** `/invoices/[id]` (`app/invoices/[id]/page.tsx`)

**Applied rules**
- Root: `.page-enter`.
- "← Invoices" back link uses Lucide `ArrowLeft` (no `←` glyph) with `hover:text-brand-600`.
- Invoice document header band: `brand?.primaryColor ?? '#1E3A5F'` (navy default; was indigo
  `#4F46E5`). White text on the band.
- Amount due uses `font-mono` + `.nums` (JetBrains Mono, tabular) for a fintech feel.
- Line-item + summary tables follow the neutral table style (`divide-slate-50`, `text-slate-400`
  headers).
- "Open payment link" uses Lucide `ExternalLink` (no `↗` glyph), `inline-flex` with gap,
  `hover:text-brand-700`.
- Side cards: Client, Summary, and an overdue reminder card — all tokenized `Card`/`CardHeader`.
- Errors: not-found uses `text-danger`; the inline error banner uses `bg-red-50 text-danger`.

**Icons:** `ArrowLeft`, `ExternalLink` — Lucide. Status pill uses `InvoiceStatusBadge`
(paid→`accent` green, overdue→`danger` red).

**Contrast note:** the document band default is navy `#1E3A5F` on white text (WCAG AA pass).
If a tenant sets a custom `primaryColor`, the same white-on-color rule applies.

'use client';

import Link from 'next/link';
import type { Invoice } from '@invoice-saas/contracts';
import { InvoiceStatusBadge } from './ui/Badge';
import { formatDate, formatMoney } from '@/lib/format';

export function InvoiceTable({
  invoices,
  showClient = false,
  clientName,
}: {
  invoices: Invoice[];
  showClient?: boolean;
  clientName?: (id: string) => string;
}) {
  if (invoices.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-bg shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-surface-border dark:text-slate-500">
            <th className="px-5 py-3 font-medium">Invoice</th>
            {showClient ? <th className="px-5 py-3 font-medium">Client</th> : null}
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Due</th>
            <th className="px-5 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="stagger divide-y divide-slate-50 dark:divide-surface-border">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-surface-muted/60">
              <td className="px-5 py-3">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="font-medium text-slate-900 hover:text-brand-600 dark:text-surface-fg dark:hover:text-brand-300"
                >
                  {inv.invoiceNumber}
                </Link>
                <div className="text-xs text-slate-400 dark:text-slate-500">{inv.currency}</div>
              </td>
              {showClient ? (
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                  {clientName?.(inv.clientId) ?? inv.clientId}
                </td>
              ) : null}
              <td className="px-5 py-3">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(inv.dueDate)}</td>
              <td className="px-5 py-3 text-right nums text-slate-900 dark:text-surface-fg">
                {formatMoney(inv.totals.totalMinor, inv.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

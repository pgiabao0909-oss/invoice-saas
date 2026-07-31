'use client';

import Link from 'next/link';
import type { Invoice } from '@invoice-saas/contracts';
import { InvoiceStatusBadge } from './ui/Badge';
import { formatDate, formatMoney } from '@/lib/format';
import { motion } from 'motion/react';

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
    <motion.div
      className="overflow-hidden rounded-[var(--radius-outer)] border border-[var(--color-border)] bg-[rgb(var(--surface-card))]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-caption text-[var(--color-border-strong)]">
            <th className="px-6 py-4 font-medium text-[var(--color-fg)]">Invoice</th>
            {showClient ? <th className="px-6 py-4 font-medium text-[var(--color-fg)]">Client</th> : null}
            <th className="px-6 py-4 font-medium text-[var(--color-fg)]">Status</th>
            <th className="px-6 py-4 font-medium text-[var(--color-fg)]">Due</th>
            <th className="px-6 py-4 text-right font-medium text-[var(--color-fg)]">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {invoices.map((inv, index) => (
            <motion.tr
              key={inv.id}
              className="hover:bg-[var(--color-muted)]/50 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.32, 0.72, 0, 1] }}
            >
              <td className="px-6 py-4">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="font-medium text-[var(--color-fg)] hover:text-[var(--color-fg)]/70 transition-colors"
                >
                  {inv.invoiceNumber}
                </Link>
                <div className="mt-0.5 text-body-sm text-[var(--color-border-strong)] nums">{inv.currency}</div>
              </td>
              {showClient ? (
                <td className="px-6 py-4 text-[var(--color-border-strong)]">
                  {clientName?.(inv.clientId) ?? inv.clientId}
                </td>
              ) : null}
              <td className="px-6 py-4">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="px-6 py-4 text-[var(--color-border-strong)] nums">{formatDate(inv.dueDate)}</td>
              <td className="px-6 py-4 text-right nums text-[var(--color-fg)] font-semibold">
                {formatMoney(inv.totals.totalMinor, inv.currency)}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
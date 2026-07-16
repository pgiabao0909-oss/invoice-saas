import { clsx } from 'clsx';
import type { InvoiceStatus } from '@invoice-saas/contracts';

// Status colors follow the design-system semantic palette. Paid → accent green,
// overdue → destructive red; draft/sent/void stay neutral–blue.
const styles: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  paid: 'bg-accent-50 text-accent-700',
  overdue: 'bg-red-50 text-danger',
  void: 'bg-zinc-100 text-zinc-500',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600',
        className,
      )}
    >
      {children}
    </span>
  );
}

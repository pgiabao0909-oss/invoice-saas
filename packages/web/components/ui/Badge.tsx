import { clsx } from 'clsx';
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Send } from 'lucide-react';
import type { InvoiceStatus } from '@invoice-saas/contracts';

// Status colors follow the design-system semantic palette. Paid → emerald (money),
// overdue → rose (danger); draft/sent/void stay calm. Icons add meaning beyond color.
const map: Record<InvoiceStatus, { cls: string; Icon: typeof CircleDashed }> = {
  draft: {
    cls: 'bg-slate-100 text-slate-600 dark:bg-surface-muted dark:text-slate-300',
    Icon: CircleDashed,
  },
  sent: {
    cls: 'bg-indigo-50 text-cta-700 dark:bg-cta-900/30 dark:text-cta-300',
    Icon: Send,
  },
  paid: {
    cls: 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300',
    Icon: CheckCircle2,
  },
  overdue: {
    cls: 'bg-rose-50 text-danger dark:bg-rose-950/40',
    Icon: AlertTriangle,
  },
  void: {
    cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-300',
    Icon: Ban,
  },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { cls, Icon } = map[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
        cls,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-surface-muted dark:text-slate-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

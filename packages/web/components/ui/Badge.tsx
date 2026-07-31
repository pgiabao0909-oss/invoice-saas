import { clsx } from 'clsx';
import { CircleDashed, PaperPlane, Check, Warning, ProhibitIcon } from '@phosphor-icons/react';
import type { InvoiceStatus } from '@invoice-saas/contracts';

const map: Record<InvoiceStatus, { cls: string; Icon: typeof CircleDashed }> = {
  draft: {
    cls: 'badge-pastel badge-blue',
    Icon: CircleDashed,
  },
  sent: {
    cls: 'badge-pastel badge-blue',
    Icon: PaperPlane,
  },
  paid: {
    cls: 'badge-pastel badge-green',
    Icon: Check,
  },
  overdue: {
    cls: 'badge-pastel badge-yellow',
    Icon: Warning,
  },
  void: {
    cls: 'badge-pastel badge-red',
    Icon: ProhibitIcon,
  },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { cls, Icon } = map[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize', cls)}>
      <Icon className="h-3.5 w-3.5" weight="bold" />
      {status}
    </span>
  );
}

export function Badge({ children, className, variant = 'neutral' }: {
  children: React.ReactNode;
  className?: string;
  variant?: 'neutral' | 'green' | 'blue' | 'yellow' | 'red';
}) {
  const variantClasses = {
    neutral: 'bg-stone-100 text-stone-700 dark:bg-darkStone-800 dark:text-stone-200',
    green: 'badge-green',
    blue: 'badge-blue',
    yellow: 'badge-yellow',
    red: 'badge-red',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
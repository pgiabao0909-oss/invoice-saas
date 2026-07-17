import { clsx } from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function KpiCard({
  label,
  value,
  hint,
  accent,
  action,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Accent the card (e.g. overdue uses danger). */
  accent?: 'default' | 'danger' | 'emerald' | 'brand';
  action?: ReactNode;
  /** Optional link target — makes the card's label + value clickable. */
  href?: string;
}) {
  const accentRing =
    accent === 'danger'
      ? 'ring-1 ring-red-100 dark:ring-red-900/40'
      : accent === 'emerald'
        ? 'ring-1 ring-accent-100 dark:ring-accent-900/40'
        : accent === 'brand'
          ? 'ring-1 ring-brand-100 dark:ring-brand-900/40'
          : '';

  const labelEl = href ? (
    <Link href={href} className="text-sm font-medium text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
      {label}
    </Link>
  ) : (
    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
  );
  const valueEl = href ? (
    <Link href={href} className="mt-2 block text-3xl font-semibold tracking-tight text-slate-900 nums dark:text-surface-fg">
      {value}
    </Link>
  ) : (
    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 nums dark:text-surface-fg">{value}</p>
  );

  return (
    <div className={clsx('rounded-2xl border border-surface-border bg-surface-bg p-5 shadow-card transition-shadow duration-200 ease-soft hover:shadow-card-hover', accentRing)}>
      <div className="flex items-start justify-between">
        {labelEl}
        {action}
      </div>
      {valueEl}
      {hint ? <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

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
  /** Accent the card (e.g. overdue uses rose). */
  accent?: 'default' | 'rose' | 'emerald' | 'brand';
  action?: ReactNode;
  /** Optional link target — makes the card's label + value clickable. */
  href?: string;
}) {
  const accentRing =
    accent === 'rose'
      ? 'ring-1 ring-rose-100'
      : accent === 'emerald'
        ? 'ring-1 ring-emerald-100'
        : accent === 'brand'
          ? 'ring-1 ring-brand-100'
          : '';

  const labelEl = href ? (
    <Link href={href} className="text-sm font-medium text-slate-500 hover:text-brand-600">
      {label}
    </Link>
  ) : (
    <p className="text-sm font-medium text-slate-500">{label}</p>
  );
  const valueEl = href ? (
    <Link href={href} className="mt-2 block text-3xl font-semibold tracking-tight text-slate-900 nums">
      {value}
    </Link>
  ) : (
    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 nums">{value}</p>
  );

  return (
    <div className={clsx('rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card', accentRing)}>
      <div className="flex items-start justify-between">
        {labelEl}
        {action}
      </div>
      {valueEl}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

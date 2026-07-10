import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export function KpiCard({
  label,
  value,
  hint,
  accent,
  action,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Accent the card (e.g. overdue uses rose). */
  accent?: 'default' | 'rose' | 'emerald' | 'brand';
  action?: ReactNode;
}) {
  const accentRing =
    accent === 'rose'
      ? 'ring-1 ring-rose-100'
      : accent === 'emerald'
        ? 'ring-1 ring-emerald-100'
        : accent === 'brand'
          ? 'ring-1 ring-brand-100'
          : '';
  return (
    <div className={clsx('rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card', accentRing)}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {action}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

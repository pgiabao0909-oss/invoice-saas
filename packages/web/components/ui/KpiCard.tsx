import { clsx } from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

type Accent = 'default' | 'danger' | 'emerald' | 'brand' | 'cta';

export function KpiCard({
  label,
  value,
  hint,
  accent = 'default',
  action,
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Accent the card (overdue uses danger, paid uses emerald). */
  accent?: Accent;
  action?: ReactNode;
  /** Optional link target — makes the card's label + value clickable. */
  href?: string;
  icon?: ReactNode;
}) {
  const ring =
    accent === 'danger'
      ? 'ring-1 ring-rose-100 dark:ring-rose-900/40'
      : accent === 'emerald'
        ? 'ring-1 ring-accent-100 dark:ring-accent-900/40'
        : accent === 'brand'
          ? 'ring-1 ring-brand-100 dark:ring-brand-900/40'
          : accent === 'cta'
            ? 'ring-1 ring-cta-100 dark:ring-cta-900/40'
            : '';

  const glow =
    accent === 'cta' || accent === 'emerald' ? (
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cta-500/10 blur-2xl dark:bg-cta-400/10" />
    ) : null;

  const valueNode = typeof value === 'number' ? <AnimatedNumber value={value} className="nums" /> : value;

  const labelEl = href ? (
    <Link
      href={href}
      className="text-sm font-medium text-slate-500 transition-colors hover:text-cta-600 dark:text-slate-400 dark:hover:text-cta-300"
    >
      {label}
    </Link>
  ) : (
    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
  );

  const valueEl = href ? (
    <Link
      href={href}
      className="mt-1 block text-3xl font-bold tracking-tight text-slate-900 nums dark:text-surface-fg"
    >
      {valueNode}
    </Link>
  ) : (
    <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 nums dark:text-surface-fg">
      {valueNode}
    </p>
  );

  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-2xl border border-surface-border bg-surface-bg p-5 shadow-card transition duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover',
        ring,
      )}
    >
      {glow}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {labelEl}
          {valueEl}
        </div>
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cta-50 text-cta-600 dark:bg-cta-900/30 dark:text-cta-300">
            {icon}
          </div>
        ) : null}
      </div>
      {action}
      {hint ? <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

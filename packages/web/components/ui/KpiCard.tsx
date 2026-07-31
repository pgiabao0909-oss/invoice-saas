import { clsx } from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

type Accent = 'default' | 'danger' | 'emerald' | 'brand' | 'cta' | 'success';

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
  accent?: Accent;
  action?: ReactNode;
  href?: string;
  icon?: ReactNode;
}) {
  const accentStyles: Record<Accent, string> = {
    default: 'border-stone-100 dark:border-darkStone-700',
    danger: 'border-pastel-red-200 dark:border-pastel-red-800',
    emerald: 'border-pastel-green-200 dark:border-pastel-green-800',
    brand: 'border-stone-200 dark:border-darkStone-600',
    cta: 'border-stone-200 dark:border-darkStone-600',
    success: 'border-pastel-green-200 dark:border-pastel-green-800',
  };

  const valueNode = typeof value === 'number' ? <AnimatedNumber value={value} className="nums" /> : value;

  const labelEl = href ? (
    <Link
      href={href}
      className="text-sm font-medium text-[var(--color-border-strong)] transition-colors hover:text-[var(--color-fg)]"
    >
      {label}
    </Link>
  ) : (
    <p className="text-sm font-medium text-[var(--color-border-strong)]">{label}</p>
  );

  const valueEl = href ? (
    <Link
      href={href}
      className="mt-2 block text-3xl font-bold tracking-tight text-[var(--color-fg)] nums"
    >
      {valueNode}
    </Link>
  ) : (
    <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-fg)] nums">
      {valueNode}
    </p>
  );

  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-[var(--radius-outer)] border shadow-bezel bg-[rgb(var(--surface-card))] p-6 transition-all duration-300 ease-taste hover:-translate-y-0.5 hover:shadow-lift',
        accentStyles[accent],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {labelEl}
          {valueEl}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-fg)]">
            {icon}
          </div>
        ) : null}
      </div>
      {action}
      {hint && <p className="mt-2 text-sm text-[var(--color-border-strong)]">{hint}</p>}
    </div>
  );
}
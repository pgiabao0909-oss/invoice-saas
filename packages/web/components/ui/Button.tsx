'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  // CTA — paid-green accent, soft shadow, calm lift on hover (no layout-shift scale).
  primary:
    'bg-accent-600 text-white shadow-md hover:bg-accent-700 hover:-translate-y-px active:translate-y-0',
  // Outlined navy — matches .btn-secondary spec.
  secondary: 'bg-surface-bg text-brand-600 border border-brand-600 hover:bg-brand-50 dark:border-brand-500 dark:hover:bg-brand-900/40',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-muted',
  danger: 'bg-danger text-white shadow-sm hover:bg-red-700',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 ease-soft',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-y-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

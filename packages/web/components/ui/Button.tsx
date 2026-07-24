'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  // CTA — indigo gradient, soft lift + spring press (no layout-shift scale).
  primary:
    'bg-cta-gradient text-white shadow-cta-sm hover:shadow-cta hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
  // Outlined indigo for secondary actions.
  secondary:
    'bg-surface-bg text-cta-700 border border-cta-200 hover:bg-cta-50 dark:border-cta-800/60 dark:text-cta-300 dark:hover:bg-cta-900/30',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-muted',
  danger: 'bg-danger text-white shadow-sm hover:bg-rose-700 active:translate-y-0',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center rounded-xl font-semibold transition duration-200 ease-spring',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner light={variant === 'primary' || variant === 'danger'} className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
}

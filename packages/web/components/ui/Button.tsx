'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import { ArrowRight, Spinner as LoaderIcon } from '@phosphor-icons/react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 ease-taste cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

const variants: Record<Variant, string> = {
  // Button-in-Button CTA: pill with trailing icon wrapper
  primary: 'bg-[var(--color-fg)] text-white shadow-[0_4px_12px_rgba(17,17,17,0.15)] hover:shadow-[0_8px_20px_rgba(17,17,17,0.2)] hover:-translate-y-0.5 active:scale-[0.98] dark:bg-white dark:text-[var(--color-bg)]',
  // Outlined secondary
  secondary: 'bg-transparent text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-muted)] active:scale-[0.98]',
  // Ghost
  ghost: 'text-[var(--color-fg)] hover:bg-[var(--color-muted)] rounded-xl px-4 py-2 active:scale-[0.98]',
  // Danger
  danger: 'bg-pastel-red-500 text-white shadow-sm hover:bg-pastel-red-600 active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-sm',
  lg: 'h-12 px-7 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  trailingIcon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  trailingIcon,
  children,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const showLoader = loading;

  return (
    <button
      disabled={disabled || loading}
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {showLoader ? (
        <span className="flex items-center justify-center">
          <LoaderIcon className="h-4 w-4 animate-spin" weight="bold" />
        </span>
      ) : (
        <>
          {children}
          {trailingIcon && !isPrimary && <span className="flex items-center">{trailingIcon}</span>}
          {isPrimary && trailingIcon && (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-transform duration-200 ease-taste hover:scale-110 hover:translate-x-[2px] hover:-translate-y-[2px]">
              {trailingIcon}
            </span>
          )}
        </>
      )}
    </button>
  );
}
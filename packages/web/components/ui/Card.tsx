import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bezel' | 'editorial';
  children: ReactNode;
}

export function Card({
  variant = 'bezel',
  className,
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'rounded-2xl border border-[var(--color-border)] bg-[rgb(var(--surface-card))] shadow-bezel transition-all duration-300 ease-taste hover:-translate-y-0.5 hover:shadow-lift',
    bezel: 'rounded-[var(--radius-outer)] border border-[var(--color-border)] bg-[rgb(var(--surface-card))] shadow-bezel transition-all duration-300 ease-taste hover:-translate-y-0.5 hover:shadow-lift',
    editorial: 'rounded-xl border border-cream-200 bg-cream-100 shadow-bezel transition-all duration-300 ease-taste hover:-translate-y-0.5 hover:shadow-lift dark:border-cream-800 dark:bg-cream-900/50',
  };

  return (
    <div
      className={clsx(variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={clsx('p-6', className)} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-6 py-4 dark:border-[var(--color-border)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
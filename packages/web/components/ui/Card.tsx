import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-surface-border bg-surface-bg shadow-card transition duration-300 ease-soft',
        'hover:-translate-y-0.5 hover:shadow-card-hover',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('p-5', className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-surface-border',
        className,
      )}
      {...props}
    />
  );
}

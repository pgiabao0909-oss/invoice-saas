import { clsx } from 'clsx';
import type { SelectHTMLAttributes } from 'react';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full cursor-pointer rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-200 ease-soft focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

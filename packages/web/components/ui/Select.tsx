'use client';

import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select
        className={clsx(
          'w-full cursor-pointer appearance-none rounded-xl border border-surface-border bg-surface-bg px-3.5 py-2.5 pr-9 text-sm text-slate-900 transition-colors duration-200 ease-soft focus:border-cta-600 focus:outline-none focus:ring-2 focus:ring-cta-600/30 dark:text-surface-fg',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

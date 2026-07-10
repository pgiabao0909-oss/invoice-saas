import { clsx } from 'clsx';
import type { SelectHTMLAttributes } from 'react';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

'use client';

import { clsx } from 'clsx';
import { CaretDown } from '@phosphor-icons/react';
import type { SelectHTMLAttributes } from 'react';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select
        className={clsx(
          'w-full cursor-pointer appearance-none select-flat pr-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-border-strong)]" weight="bold" />
    </div>
  );
}
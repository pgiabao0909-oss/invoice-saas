'use client';

import { clsx } from 'clsx';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative z-10 w-full max-w-lg rounded-2xl border border-surface-border bg-surface-bg shadow-xl',
          'page-enter',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-surface-border">
          <h2 className="text-base text-slate-900 dark:text-surface-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-surface-muted dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-surface-border">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

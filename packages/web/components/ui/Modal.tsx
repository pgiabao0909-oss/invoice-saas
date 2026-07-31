'use client';

import { clsx } from 'clsx';
import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: Size;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 glass-overlay"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={clsx(
              'relative z-10 w-full rounded-[var(--radius-outer)] border border-[var(--color-border)] bg-[rgb(var(--surface-card))] shadow-[var(--shadow-glass)] overflow-hidden',
              sizes[size],
            )}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
              <h2 id="modal-title" className="text-lg font-semibold text-[var(--color-fg)]">
                {title}
              </h2>
              <motion.button
                onClick={onClose}
                className="rounded-lg p-1 text-[var(--color-border-strong)] hover:bg-[var(--color-muted)] transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Close modal"
              >
                <X className="h-5 w-5" weight="regular" />
              </motion.button>
            </div>
            <div className="p-6">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
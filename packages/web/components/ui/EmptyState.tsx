import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export function EmptyState({
  title,
  description,
  action,
  icon,
  illustration,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center rounded-[var(--radius-outer)] border border-[var(--color-border)] bg-[rgb(var(--surface-card))] px-8 py-16 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
    >
      {illustration ? (
        <motion.div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-muted)]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          {illustration}
        </motion.div>
      ) : icon ? (
        <motion.div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-fg)]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          {icon}
        </motion.div>
      ) : null}
      <motion.h3
        className="text-heading-md font-heading tracking-tight text-[var(--color-fg)]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        {title}
      </motion.h3>
      {description && (
        <motion.p
          className="mt-2 max-w-sm text-body text-[var(--color-border-strong)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          {description}
        </motion.p>
      )}
      {action && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
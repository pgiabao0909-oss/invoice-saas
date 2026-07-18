import { clsx } from 'clsx';

export function Spinner({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-transparent',
        light
          ? 'border-white/40 border-t-white'
          : 'border-slate-300 border-t-cta-600 dark:border-slate-700 dark:border-t-cta-400',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] dark:bg-surface-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

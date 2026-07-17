import { clsx } from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-700',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-surface-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

import { clsx } from 'clsx';

export function Spinner({ className, light, size = 'md' }: {
  className?: string;
  light?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <span
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-transparent',
        light
          ? 'border-white/40 border-t-white'
          : 'border-[var(--color-border)] border-t-[var(--color-fg)]',
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-[blob-drift_20s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-stone-300/50 via-stone-400/30 to-stone-300/50 blur-xl" />
          <Spinner size="lg" />
        </div>
        <p className="text-sm text-[var(--color-border-strong)]">Loading…</p>
      </div>
    </div>
  );
}

// CSS ambient blob for decorative loading states
export function AmbientBlob({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'absolute inset-0 animate-[blob-drift_20s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-stone-300/30 via-stone-400/20 to-stone-300/30 blur-2xl pointer-events-none',
        className,
      )}
      aria-hidden="true"
    />
  );
}
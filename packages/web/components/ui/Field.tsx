import { clsx } from 'clsx';
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const controlBase = clsx(
  'w-full rounded-xl border border-[var(--color-border)] bg-[rgb(var(--surface-card))] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-border-strong)]',
  'transition-all duration-200 ease-taste',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-transparent',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={clsx('mb-2 block text-sm font-medium text-[var(--color-fg)]', className)}
    >
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(controlBase, className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(controlBase, 'min-h-[100px] resize-y', className)}
      {...props}
    />
  );
}

interface MoneyInputProps {
  valueMinor: number;
  onChangeMinor: (minor: number) => void;
  currency: string;
  className?: string;
}

export function MoneyInput({ valueMinor, onChangeMinor, currency, className }: MoneyInputProps) {
  const major = (valueMinor / 100).toFixed(2);
  return (
    <div className={clsx('relative', className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-border-strong)]">
        {currency}
      </span>
      <Input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        className={clsx(controlBase, 'pl-12 nums')}
        value={major}
        onChange={(e) => {
          const n = Math.round((parseFloat(e.target.value || '0') || 0) * 100);
          onChangeMinor(Number.isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, htmlFor, children, hint, error }: FieldProps) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-pastel-red-600 dark:text-pastel-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-[var(--color-border-strong)]">{hint}</p>
      ) : null}
    </div>
  );
}
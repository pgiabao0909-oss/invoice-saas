import { clsx } from 'clsx';
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const controlBase =
  'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-200 ease-soft focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30';

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
    <label htmlFor={htmlFor} className={clsx('mb-1.5 block text-sm font-medium text-slate-700', className)}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(controlBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(controlBase, 'min-h-[80px]', className)} {...props} />;
}

/** Numeric input rendered in minor units with a currency prefix; shows major-unit value. */
export function MoneyInput({
  valueMinor,
  onChangeMinor,
  currency,
  className,
}: {
  valueMinor: number;
  onChangeMinor: (minor: number) => void;
  currency: string;
  className?: string;
}) {
  const major = (valueMinor / 100).toString();
  return (
    <div className={clsx('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        {currency}
      </span>
      <input
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

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

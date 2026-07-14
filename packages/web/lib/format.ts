import type { CurrencyCode, Money } from '@invoice-saas/contracts';

/** Render integer minor units (cents) as a localized currency string. */
export function formatMoney(minor: Money, currency: CurrencyCode): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Parse a major-unit string ("12.50") into integer minor units (1250). */
export function parseMajorToMinor(value: string): number {
  const n = Math.round((parseFloat(value || '0') || 0) * 100);
  return Number.isFinite(n) ? n : 0;
}

/** Convert minor units back to a major-unit string for inputs. */
export function minorToMajor(minor: number): string {
  return (minor / 100).toString();
}

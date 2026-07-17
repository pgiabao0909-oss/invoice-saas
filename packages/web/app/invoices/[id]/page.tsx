'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { api, ApiError } from '@/lib/api';
import type { InvoiceWithClient } from '@invoice-saas/contracts';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatMoney } from '@/lib/format';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { tenant } = useTenant();
  const [inv, setInv] = useState<InvoiceWithClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setInv(await api.getInvoice(params.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tenant) void load();
  }, [tenant, params.id]);

  async function send() {
    if (!inv) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendInvoice(inv.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  if (!tenant) return null;
  if (loading)
    return (
      <div className="py-20 text-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  if (error || !inv)
    return <div className="py-20 text-center text-danger">{error ?? 'Not found'}</div>;

  const currency = inv.currency;
  const brand = tenant.branding;
  const balance = inv.totals.totalMinor - inv.amountPaidMinor;

  return (
    <div className="page-enter">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Invoices
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-surface-fg">{inv.invoiceNumber}</h1>
            <InvoiceStatusBadge status={inv.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {inv.status === 'draft' ? (
            <Button onClick={send} disabled={busy}>
              {busy ? 'Sending…' : 'Send invoice'}
            </Button>
          ) : null}
          {inv.paymentLink ? (
            <Button variant="secondary" onClick={() => window.open(inv!.paymentLink, '_blank')}>
              Pay online
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="overflow-hidden rounded-2xl">
              <div className="px-5 py-4" style={{ background: brand?.primaryColor ?? '#1E3A5F' }}>
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-semibold">
                    {brand?.displayName ?? tenant.name}
                  </span>
                  <span className="text-xs uppercase tracking-wide">Invoice</span>
                </div>
              </div>
              <CardBody>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Bill to</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{inv.client.legalName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{inv.client.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Amount due</p>
                    <p className="nums font-mono text-xl font-semibold text-slate-900 dark:text-surface-fg">
                      {formatMoney(inv.totals.totalMinor, currency)}
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-surface-border dark:text-slate-500">
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Unit</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-surface-border">
                    {inv.lineItems.map((li, i) => (
                      <tr key={i}>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{li.description}</td>
                        <td className="py-2 text-right nums text-slate-500 dark:text-slate-400">{li.quantity}</td>
                        <td className="py-2 text-right nums text-slate-500 dark:text-slate-400">
                          {formatMoney(li.unitPriceMinor, currency)}
                        </td>
                        <td className="py-2 text-right nums text-slate-800 dark:text-slate-200">
                          {formatMoney(li.quantity * li.unitPriceMinor, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm dark:border-surface-border">
                  <Row label="Subtotal" value={formatMoney(inv.totals.subtotalMinor, currency)} />
                  <Row label="Tax" value={formatMoney(inv.totals.taxMinor, currency)} />
                  {inv.totals.discountMinor > 0 ? (
                    <Row
                      label="Discount"
                      value={`- ${formatMoney(inv.totals.discountMinor, currency)}`}
                    />
                  ) : null}
                  <Row label="Total" value={formatMoney(inv.totals.totalMinor, currency)} bold />
                  {inv.amountPaidMinor > 0 ? (
                    <Row label="Paid" value={formatMoney(inv.amountPaidMinor, currency)} />
                  ) : null}
                </div>
              </CardBody>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Client</h3>
            </CardHeader>
            <CardBody className="text-sm">
              <p className="font-medium text-slate-800 dark:text-slate-200">{inv.client.legalName}</p>
              <p className="text-slate-500 dark:text-slate-400">{inv.client.email}</p>
              {inv.client.taxIdentifier ? (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Tax ID: {inv.client.taxIdentifier}</p>
              ) : null}
              {inv.client.billingAddress ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{inv.client.billingAddress}</p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Summary</h3>
            </CardHeader>
            <CardBody className="space-y-1 text-sm">
              <Row label="Status" value={inv.status} />
              <Row label="Outstanding" value={formatMoney(balance, currency)} />
              <Row label="Currency" value={currency} />
              {inv.paymentLink ? (
                <a
                  href={inv.paymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 pt-2 text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  Open payment link
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </CardBody>
          </Card>

          {inv.status === 'overdue' ? (
            <Card>
              <CardBody className="text-sm text-slate-600 dark:text-slate-400">
                Payment is overdue. Reminder emails are sent automatically (+1, +7, +14 days).
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={bold ? 'nums font-semibold text-slate-900 dark:text-surface-fg' : 'nums text-slate-800 dark:text-slate-200'}>
        {value}
      </span>
    </div>
  );
}

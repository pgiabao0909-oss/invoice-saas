'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { ArrowLeft, ArrowSquareOut, Check, Warning } from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api, ApiError } from '@/lib/api';
import type { InvoiceWithClient } from '@invoice-saas/contracts';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatMoney } from '@/lib/format';

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <motion.div
      className="flex justify-between"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      <span className="text-body text-[var(--color-border-strong)]">{label}</span>
      <span className={clsx('nums', bold ? 'font-semibold text-[var(--color-fg)]' : 'text-[var(--color-fg)]')}>
        {value}
      </span>
    </motion.div>
  );
}

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
      <motion.div className="flex min-h-[100dvh] items-center justify-center bg-cream-50 dark:bg-darkStone-950">
        <Spinner className="h-8 w-8" />
      </motion.div>
    );
  if (error || !inv)
    return (
      <motion.div className="flex min-h-[100dvh] items-center justify-center bg-cream-50 dark:bg-darkStone-950">
        <p className="text-body text-pastel-red-600 dark:text-pastel-red-400">{error ?? 'Not found'}</p>
      </motion.div>
    );

  const currency = inv.currency;
  const brand = tenant.branding;
  const balance = inv.totals.totalMinor - inv.amountPaidMinor;
  const primaryColor = brand?.primaryColor ?? '#1E3A5F';

  return (
    <div className="page-enter min-h-[100dvh] bg-cream-50 dark:bg-darkStone-950">
      {/* Back link */}
      <motion.div className="mx-auto max-w-4xl px-4 py-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-body text-[var(--color-border-strong)] hover:text-[var(--color-fg)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" weight="regular" />
          Invoices
        </Link>
      </motion.div>

      <motion.main className="mx-auto max-w-4xl px-4 pb-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}>
        {/* Header */}
        <motion.div
          className="mb-6 flex flex-wrap items-start justify-between gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
        >
          <div>
            <div className="flex items-center gap-3">
              <motion.h1
                className="text-display-sm font-heading tracking-tight text-[var(--color-fg)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
              >
                {inv.invoiceNumber}
              </motion.h1>
              <InvoiceStatusBadge status={inv.status} />
            </div>
            <motion.p
              className="mt-2 text-body text-[var(--color-border-strong)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
            </motion.p>
          </div>
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            {inv.status === 'draft' && (
              <Button onClick={send} disabled={busy} size="lg">
                {busy ? 'Sending…' : 'Send invoice'}
              </Button>
            )}
            {inv.paymentLink && (
              <Button variant="secondary" size="lg" onClick={() => window.open(inv.paymentLink, '_blank')} trailingIcon={<ArrowSquareOut className="h-4 w-4" weight="regular" />}>
                Pay online
              </Button>
            )}
          </motion.div>
        </motion.div>

        {error && (
          <motion.p
            className="mb-6 rounded-xl bg-pastel-red-100 px-4 py-3 text-body text-pastel-red-600 dark:bg-pastel-red-900/30 dark:text-pastel-red-400"
            role="alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.p>
        )}

        {/* Editorial Luxury Document */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          {/* Invoice Document */}
          <Card variant="editorial">
            <div className="overflow-hidden rounded-[var(--radius-outer)]">
              {/* Document header band */}
              <div
                className="px-8 py-6 text-white"
                style={{ background: primaryColor }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-heading-sm font-heading tracking-tight">
                    {brand?.displayName ?? tenant.name}
                  </span>
                  <span className="text-caption text-white/70">Invoice</span>
                </div>
              </div>

              <CardBody className="space-y-6">
                {/* Bill to / Amount due */}
                <motion.div
                  className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
                >
                  <div>
                    <p className="text-caption text-[var(--color-border-strong)]">Bill to</p>
                    <p className="mt-1 text-heading-md font-heading text-[var(--color-fg)]">{inv.client.legalName}</p>
                    <p className="mt-0.5 text-body text-[var(--color-border-strong)]">{inv.client.email}</p>
                  </div>
                  <div className="text-right lg:text-right">
                    <p className="text-caption text-[var(--color-border-strong)]">Amount due</p>
                    <p className="mt-1 text-display-md font-mono text-[var(--color-fg)]">
                      {formatMoney(inv.totals.totalMinor, currency)}
                    </p>
                  </div>
                </motion.div>

                {/* Line items table */}
                <motion.table
                  className="w-full text-sm"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
                >
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-caption text-[var(--color-border-strong)] dark:border-cream-800">
                      <th className="py-4 pr-4 font-medium text-[var(--color-fg)]">Description</th>
                      <th className="py-4 pr-4 text-right font-medium text-[var(--color-fg)] nums">Qty</th>
                      <th className="py-4 pr-4 text-right font-medium text-[var(--color-fg)] nums">Unit</th>
                      <th className="py-4 text-right font-medium text-[var(--color-fg)] nums">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200 dark:divide-cream-800">
                    {inv.lineItems.map((li, i) => (
                      <motion.tr
                        key={i}
                        className="hover:bg-cream-100/50 dark:hover:bg-cream-900/20 transition-colors"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 + i * 0.08, ease: [0.32, 0.72, 0, 1] }}
                      >
                        <td className="py-4 pr-4 text-[var(--color-fg)]">{li.description}</td>
                        <td className="py-4 pr-4 text-right nums text-[var(--color-border-strong)]">{li.quantity}</td>
                        <td className="py-4 pr-4 text-right nums text-[var(--color-border-strong)]">
                          {formatMoney(li.unitPriceMinor, currency)}
                        </td>
                        <td className="py-4 text-right nums text-[var(--color-fg)] font-medium">
                          {formatMoney(li.quantity * li.unitPriceMinor, currency)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </motion.table>

                {/* Totals */}
                <motion.div
                  className="space-y-2 border-t border-cream-200 pt-4 text-sm dark:border-cream-800"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4, ease: [0.32, 0.72, 0, 1] }}
                >
                  <Row label="Subtotal" value={formatMoney(inv.totals.subtotalMinor, currency)} />
                  <Row label="Tax" value={formatMoney(inv.totals.taxMinor, currency)} />
                  {inv.totals.discountMinor > 0 ? (
                    <Row label="Discount" value={`- ${formatMoney(inv.totals.discountMinor, currency)}`} />
                  ) : null}
                  <Row label="Total" value={formatMoney(inv.totals.totalMinor, currency)} bold />
                  {inv.amountPaidMinor > 0 && (
                    <Row label="Paid" value={formatMoney(inv.amountPaidMinor, currency)} />
                  )}
                </motion.div>
              </CardBody>
            </div>
          </Card>

          {/* Side cards */}
          <motion.div className="space-y-6 lg:grid lg:grid-cols-3 lg:gap-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <Card variant="editorial">
              <CardHeader>
                <h3 className="text-heading-sm font-heading text-[var(--color-fg)]">Client</h3>
              </CardHeader>
              <CardBody className="space-y-2 text-body">
                <p className="font-medium text-[var(--color-fg)]">{inv.client.legalName}</p>
                <p className="text-[var(--color-border-strong)]">{inv.client.email}</p>
                {inv.client.taxIdentifier && (
                  <p className="text-caption text-[var(--color-border-strong)]">Tax ID: {inv.client.taxIdentifier}</p>
                )}
                {inv.client.billingAddress && (
                  <p className="text-caption text-[var(--color-border-strong)]">{inv.client.billingAddress}</p>
                )}
              </CardBody>
            </Card>

            <Card variant="editorial">
              <CardHeader>
                <h3 className="text-heading-sm font-heading text-[var(--color-fg)]">Summary</h3>
              </CardHeader>
              <CardBody className="space-y-2 text-body">
                <Row label="Status" value={inv.status} />
                <Row label="Outstanding" value={formatMoney(balance, currency)} />
                <Row label="Currency" value={currency} />
                {inv.paymentLink && (
                  <motion.a
                    href={inv.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 pt-2 text-pastel-blue-600 hover:text-pastel-blue-700 dark:text-pastel-blue-400 dark:hover:text-pastel-blue-300 transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    Open payment link
                    <ArrowSquareOut className="h-3.5 w-3.5" weight="regular" />
                  </motion.a>
                )}
              </CardBody>
            </Card>

            {inv.status === 'overdue' && (
              <Card variant="editorial" className="border-pastel-yellow-200 dark:border-pastel-yellow-800">
                <CardBody className="flex items-center gap-3 p-4 text-body text-[var(--color-fg)]">
                  <Warning className="h-5 w-5 text-pastel-yellow-600 dark:text-pastel-yellow-400" weight="bold" />
                  <p>Payment is overdue. Reminder emails are sent automatically (+1, +7, +14 days).</p>
                </CardBody>
              </Card>
            )}
          </motion.div>
        </motion.div>
      </motion.main>
    </div>
  );
}
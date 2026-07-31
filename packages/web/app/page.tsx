'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  FileText,
  PaperPlane,
  Check,
  Warning,
  ArrowRight,
  Sparkle,
  Wallet,
  CircleDashed,
} from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import type { Client, DashboardStats, Invoice } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { InvoiceTable } from '@/components/InvoiceTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input, Field } from '@/components/ui/Field';
import { formatMoney } from '@/lib/format';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const STATUS_CONFIG = [
  { key: 'draft' as const, label: 'Draft', icon: FileText, color: 'stone', badge: 'blue' },
  { key: 'sent' as const, label: 'Sent', icon: PaperPlane, color: 'stone', badge: 'blue' },
  { key: 'paid' as const, label: 'Paid', icon: Check, color: 'stone', badge: 'green' },
  { key: 'overdue' as const, label: 'Overdue', icon: Warning, color: 'stone', badge: 'yellow' },
] as const;

function StatusHealth({ stats }: { stats: DashboardStats }) {
  const total = stats.draft + stats.sent + stats.paid + stats.overdue || 1;

  return (
    <motion.div
      className="rounded-[var(--radius-outer)] border border-[var(--color-border)] bg-[rgb(var(--surface-card))] p-6 shadow-bezel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="mb-4">
        <h2 className="text-heading-sm text-[var(--color-fg)]">Invoice health</h2>
        <p className="mt-1 text-body-sm text-[var(--color-border-strong)]">Live breakdown by status</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* Editorial donut */}
        <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            <circle
              cx="90"
              cy="90"
              r="72"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="12"
            />
            {STATUS_CONFIG.map((s, i) => {
              const value = stats[s.key];
              const len = (value / total) * 2 * Math.PI * 72;
              const prev = STATUS_CONFIG.slice(0, i).reduce((sum, st) => sum + stats[st.key], 0);
              const offset = (prev / total) * 2 * Math.PI * 72;
              return (
                <motion.circle
                  key={s.key}
                  cx="90"
                  cy="90"
                  r="72"
                  fill="none"
                  stroke={`var(--pastel-${s.badge}-500)`}
                  strokeWidth="12"
                  strokeDasharray={`${len} ${2 * Math.PI * 72 - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${2 * Math.PI * 72}`, strokeDashoffset: 0 }}
                  animate={{ strokeDasharray: `${len} ${2 * Math.PI * 72 - len}`, strokeDashoffset: -offset }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: [0.32, 0.72, 0, 1] }}
                />
              );
            })}
          </svg>
          <div className="absolute flex flex-col items-center">
            <AnimatedNumber value={total} format={(n) => n.toLocaleString()} className="text-display-sm text-[var(--color-fg)]" />
            <span className="text-body-sm text-[var(--color-border-strong)]">invoices</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-4 gap-4 text-center">
          {STATUS_CONFIG.map((s) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + STATUS_CONFIG.indexOf(s) * 0.08, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className={`h-2.5 w-2.5 rounded-full bg-pastel-${s.badge}-500`} />
                <span className="capitalize text-body-sm text-[var(--color-border-strong)]">{s.label}</span>
              </div>
              <AnimatedNumber
                value={stats[s.key]}
                format={(n) => n.toLocaleString()}
                className="text-heading-md nums text-[var(--color-fg)]"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { tenant, stats, refresh } = useTenant();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [showSweep, setShowSweep] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    if (!tenant) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [inv, cl] = await Promise.all([api.listInvoices(), api.listClients()]);
      if (active) {
        setInvoices(inv.slice(0, 5));
        setClients(cl);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant]);

  const currency = tenant?.baseCurrency ?? 'USD';
  const clientName = (id: string) => clients.find((c) => c.id === id)?.legalName ?? id;

  async function runSweep() {
    const token = tokenInput.trim();
    if (!token) return;
    setSweeping(true);
    setSweepMsg(null);
    try {
      const res = await api.runOverdue(token);
      setSweepMsg(
        `Sweep complete: ${res.flipped} invoice(s) moved to overdue, ${res.remindersEnqueued} reminder(s) queued.`,
      );
      await refresh();
    } catch (e) {
      setSweepMsg(`Sweep failed: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setSweeping(false);
      setShowSweep(false);
      setTokenInput('');
    }
  }

  if (!tenant) return null;

  return (
    <div className="page-enter">
      <PageHeader
        title={`Welcome back, ${tenant.branding?.displayName ?? tenant.name}`}
        description="Your invoicing at a glance."
      />

      {/* Asymmetrical Bento KPI Grid */}
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Draft"
          value={stats?.draft ?? 0}
          href="/invoices?status=draft"
          icon={<FileText className="h-5 w-5" weight="bold" />}
          accent="default"
        />
        <KpiCard
          label="Sent"
          value={stats?.sent ?? 0}
          href="/invoices?status=sent"
          icon={<PaperPlane className="h-5 w-5" weight="bold" />}
          accent="default"
        />
        <KpiCard
          label="Paid"
          value={stats?.paid ?? 0}
          href="/invoices?status=paid"
          icon={<Check className="h-5 w-5" weight="bold" />}
          accent="success"
        />
        <KpiCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          href="/invoices?status=overdue"
          icon={<Warning className="h-5 w-5" weight="bold" />}
          accent="danger"
          action={
            <Button size="sm" variant="ghost" onClick={() => setShowSweep(true)} disabled={sweeping}>
              {sweeping ? 'Running…' : 'Run sweep'}
            </Button>
          }
        />
        <KpiCard
          label="Outstanding"
          value={stats ? formatMoney(stats.outstandingMinor, currency) : '—'}
          href="/invoices"
          icon={<Wallet className="h-5 w-5" weight="bold" />}
          accent="cta"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-heading-sm text-[var(--color-fg)]">Recent invoices</h2>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1 text-body text-[var(--color-border-strong)] hover:text-[var(--color-fg)] transition-colors"
            >
              View all <ArrowRight className="h-4 w-4" weight="regular" />
            </Link>
          </div>
          {loading ? (
            <div className="py-10 text-center">
              <Spinner className="h-5 w-5" />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Create your first invoice to see it here."
              action={
                <Link href="/invoices/new">
                  <Button size="sm">New invoice</Button>
                </Link>
              }
            />
          ) : (
            <InvoiceTable invoices={invoices} showClient clientName={clientName} />
          )}
        </div>

        <StatusHealth stats={stats!} />
      </div>

      {sweepMsg ? (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-xl bg-stone-100 px-4 py-3 text-body text-stone-700 dark:bg-darkStone-800 dark:text-stone-200"
          role="status"
        >
          {sweepMsg}
        </motion.p>
      ) : null}

      <Modal
        open={showSweep}
        onClose={() => setShowSweep(false)}
        title="Run overdue sweep"
        footer={
          <Button onClick={runSweep} loading={sweeping} disabled={!tokenInput.trim()}>
            Run sweep
          </Button>
        }
      >
        <p className="mb-4 text-body text-[var(--color-border-strong)]">
          This flips past-due sent invoices to <span className="font-semibold text-[var(--color-fg)]">overdue</span> and queues reminder emails. Needs your admin token.
        </p>
        <Field label="Admin token (ADMIN_API_TOKEN)">
          <Input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste admin token"
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  );
}
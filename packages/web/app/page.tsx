'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Send,
  Sparkles,
  Wallet,
} from 'lucide-react';
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

const DONUT = [
  { key: 'draft', color: '#94a3b8' },
  { key: 'sent', color: '#6366f1' },
  { key: 'paid', color: '#059669' },
  { key: 'overdue', color: '#e11d48' },
] as const;

function StatusDonut({ stats }: { stats: DashboardStats }) {
  const total = stats.draft + stats.sent + stats.paid + stats.overdue || 1;
  const r = 42;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-44 w-44 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--surface-border))" strokeWidth="11" />
        {DONUT.map((s) => {
          const value = stats[s.key];
          const len = (value / total) * circ;
          const el = (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="11"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-[stroke-dasharray] duration-700 ease-soft"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight text-slate-900 nums dark:text-surface-fg">
          {total}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">invoices</span>
      </div>
    </div>
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

      <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Draft"
          value={stats?.draft ?? 0}
          href="/invoices?status=draft"
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          label="Sent"
          value={stats?.sent ?? 0}
          href="/invoices?status=sent"
          icon={<Send className="h-5 w-5" />}
        />
        <KpiCard
          label="Paid"
          value={stats?.paid ?? 0}
          accent="emerald"
          href="/invoices?status=paid"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          accent="danger"
          href="/invoices?status=overdue"
          icon={<AlertTriangle className="h-5 w-5" />}
          action={
            <Button size="sm" variant="ghost" onClick={() => setShowSweep(true)} disabled={sweeping}>
              {sweeping ? 'Running…' : 'Run sweep'}
            </Button>
          }
        />
        <KpiCard
          label="Outstanding"
          value={stats ? formatMoney(stats.outstandingMinor, currency) : '—'}
          accent="cta"
          href="/invoices"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent invoices</h2>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1 text-sm font-medium text-cta-600 transition-colors hover:text-cta-700 dark:text-cta-300 dark:hover:text-cta-200"
            >
              View all <ArrowUpRight className="h-4 w-4" />
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
              icon={<Sparkles className="h-6 w-6" />}
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

        <div className="rounded-2xl border border-surface-border bg-surface-bg p-5 shadow-card">
          <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Invoice health</h2>
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">Live breakdown by status</p>
          {stats ? (
            <div className="flex flex-col items-center">
              <StatusDonut stats={stats} />
              <div className="mt-3 grid w-full grid-cols-2 gap-2 text-xs">
                {DONUT.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="capitalize text-slate-500 dark:text-slate-400">{s.key}</span>
                    <span className="ml-auto nums font-semibold text-slate-700 dark:text-slate-200">
                      {stats[s.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">
              <Spinner className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>

      {sweepMsg ? (
        <p className="mt-4 rounded-xl bg-cta-50 px-4 py-2.5 text-sm text-cta-700 dark:bg-cta-900/30 dark:text-cta-200">
          {sweepMsg}
        </p>
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
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          This flips past-due sent invoices to <span className="font-medium text-slate-700 dark:text-slate-200">overdue</span> and queues reminder emails. Needs your admin token.
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

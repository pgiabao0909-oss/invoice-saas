'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import type { Client, Invoice } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { InvoiceTable } from '@/components/InvoiceTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatMoney } from '@/lib/format';

export default function DashboardPage() {
  const { tenant, stats, refresh } = useTenant();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

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
    const token = window.prompt('Admin token (ADMIN_API_TOKEN) for the overdue sweep:');
    if (!token) return;
    setSweeping(true);
    setSweepMsg(null);
    try {
      const res = await api.runOverdue(token.trim());
      setSweepMsg(
        `Sweep complete: ${res.flipped} invoice(s) moved to overdue, ${res.remindersEnqueued} reminder(s) queued.`,
      );
      await refresh();
    } catch (e) {
      setSweepMsg(`Sweep failed: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setSweeping(false);
    }
  }

  if (!tenant) return null;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${tenant.branding?.displayName ?? tenant.name}`}
        description="Your invoicing at a glance."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Draft" value={stats?.draft ?? 0} />
        <KpiCard label="Sent" value={stats?.sent ?? 0} />
        <KpiCard label="Paid" value={stats?.paid ?? 0} accent="emerald" />
        <KpiCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          accent="rose"
          action={
            <Button size="sm" variant="ghost" onClick={runSweep} disabled={sweeping}>
              {sweeping ? 'Running…' : 'Run sweep'}
            </Button>
          }
        />
        <KpiCard
          label="Outstanding"
          value={stats ? formatMoney(stats.outstandingMinor, currency) : '—'}
          accent="brand"
        />
      </div>

      {sweepMsg ? (
        <p className="mt-3 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-600">{sweepMsg}</p>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent invoices</h2>
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
    </div>
  );
}

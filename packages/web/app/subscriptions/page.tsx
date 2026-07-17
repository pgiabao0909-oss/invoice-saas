'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import { computeTotals } from '@invoice-saas/contracts';
import type { Client, Subscription } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatMoney } from '@/lib/format';

function cadence(sub: Subscription): string {
  const n = sub.intervalCount;
  const unit = n === 1 ? sub.intervalUnit : `${sub.intervalUnit}s`;
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}`;
}

export default function SubscriptionsPage() {
  const { tenant } = useTenant();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [s, c] = await Promise.all([api.listSubscriptions(), api.listClients()]);
      if (active) {
        setSubs(s);
        setClients(c);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.legalName ?? id;

  if (!tenant) return null;

  return (
    <div className="page-enter">
      <PageHeader
        title="Subscriptions"
        description="Recurring schedules that auto-generate and send invoices — hands-off billing."
        actions={
          <Link href="/subscriptions/new">
            <Button size="sm">+ New subscription</Button>
          </Link>
        }
      />

      {loading ? (
        <div className="py-10 text-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : subs.length === 0 ? (
        <EmptyState
          title="No subscriptions"
          description="Set up a recurring schedule and we'll bill the client automatically each period."
          action={
            <Link href="/subscriptions/new">
              <Button size="sm">New subscription</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-bg shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-surface-border dark:text-slate-500">
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Cadence</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Next charge</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="stagger divide-y divide-slate-50 dark:divide-surface-border">
              {subs.map((sub) => {
                const totals = computeTotals(sub.lineItems, [], sub.discount);
                return (
                  <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900 dark:text-surface-fg">{clientName(sub.clientId)}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{sub.currency}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{cadence(sub)}</td>
                    <td className="px-5 py-3">
                      {sub.active ? (
                        <Badge className="bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">Active</Badge>
                      ) : (
                        <Badge className="bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-300">Paused</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(sub.anchorDate)}</td>
                    <td className="px-5 py-3 text-right nums text-slate-900 dark:text-surface-fg">
                      {formatMoney(totals.totalMinor, sub.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Plus, Calendar, CreditCard, Pause, Play } from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import { computeTotals } from '@invoice-saas/contracts';
import type { Client, Subscription } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        <PageHeader
          title="Subscriptions"
          description="Recurring schedules that auto-generate and send invoices — hands-off billing."
          actions={
            <Link href="/subscriptions/new">
              <Button size="sm" trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
                New subscription
              </Button>
            </Link>
          }
        />
      </motion.div>

      {loading ? (
        <motion.div
          className="py-10 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Spinner className="h-5 w-5 mx-auto" />
        </motion.div>
      ) : subs.length === 0 ? (
        <EmptyState
          title="No subscriptions"
          description="Set up a recurring schedule and we'll bill the client automatically each period."
          action={
            <Link href="/subscriptions/new">
              <Button size="sm" trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
                New subscription
              </Button>
            </Link>
          }
        />
      ) : (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
        >
          {subs.map((sub, index) => {
            const totals = computeTotals(sub.lineItems, [], sub.discount);
            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.08, ease: [0.32, 0.72, 0, 1] }}
              >
                <Card variant="bezel">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)]"
                      >
                        <CreditCard className="h-6 w-6 text-[var(--color-fg)]" weight="regular" />
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--color-fg)]">{clientName(sub.clientId)}</div>
                        <div className="text-body-sm text-[var(--color-border-strong)] nums">{sub.currency}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-[var(--color-border-strong)]">
                        <Calendar className="h-4 w-4" weight="regular" />
                        {cadence(sub)}
                      </div>
                      <div className="flex items-center gap-1 text-[var(--color-border-strong)]">
                        <CreditCard className="h-4 w-4" weight="regular" />
                        {formatDate(sub.anchorDate)}
                      </div>
                      <Badge variant={sub.active ? 'green' : 'neutral'}>{sub.active ? 'Active' : 'Paused'}</Badge>
                      <div className="ml-auto text-right">
                        <div className="text-heading-sm font-bold text-[var(--color-fg)] nums">
                          {formatMoney(totals.totalMinor, sub.currency)}
                        </div>
                        <div className="text-body-sm text-[var(--color-border-strong)]">per period</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
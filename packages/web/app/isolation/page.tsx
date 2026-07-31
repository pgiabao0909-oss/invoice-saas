'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Warning, Check, Database, Users, WarningCircle } from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import type { IsolationStatus } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

interface ViolationDetail {
  route?: string;
  method?: string;
  expectedTenantId?: string;
  violations?: Array<{ path: string; tenantId: string }>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function IsolationPage() {
  const { tenant } = useTenant();
  const [status, setStatus] = useState<IsolationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tenant) return null;

  async function load() {
    const token = window.prompt('Admin token (ADMIN_API_TOKEN) to read isolation status:');
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await api.getIsolationStatus(token.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load isolation status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  const foreignTotal = status
    ? Object.values(status.foreignRows).reduce((a, b) => a + b, 0)
    : 0;
  const foreignEntries = status ? Object.entries(status.foreignRows) : [];

  return (
    <div className="page-enter">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        <PageHeader
          title="Tenant Isolation"
          description="System-wide cross-tenant leak detection (C6). Reads the audit trail and scans every tenant-scoped table."
          actions={
            <Button onClick={load} disabled={loading} trailingIcon={loading ? undefined : <ShieldCheck className="h-4 w-4" weight="bold" />}>
              {loading ? 'Checking…' : status ? 'Refresh' : 'Load status'}
            </Button>
          }
        />
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

      {!status ? (
        <EmptyState
          title="No scan loaded yet"
          description="Load the isolation status with your admin token to see boundary violations and foreign-row scan results."
          action={<Button onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Load status'}</Button>}
        />
      ) : (
        <>
          <motion.div
            className="stagger grid grid-cols-2 gap-4 sm:grid-cols-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          >
            <KpiCard
              label="Posture"
              value={status.healthy ? 'Healthy' : 'ALERT'}
              accent={status.healthy ? 'success' : 'danger'}
              hint={status.healthy ? 'No leaks detected' : 'Action required'}
              icon={status.healthy ? <ShieldCheck className="h-5 w-5" weight="bold" /> : <Warning className="h-5 w-5" weight="bold" />}
            />
            <KpiCard
              label="Boundary violations"
              value={status.violations.length}
              accent={status.violations.length > 0 ? 'danger' : 'default'}
              hint="last 10 min"
              icon={<WarningCircle className="h-5 w-5" weight="regular" />}
            />
            <KpiCard
              label="Foreign rows"
              value={foreignTotal}
              accent={foreignTotal > 0 ? 'danger' : 'default'}
              hint="rows with unknown tenantId"
              icon={<Database className="h-5 w-5" weight="regular" />}
            />
            <KpiCard label="Tenants" value={status.tenants} hint="known tenantIds" icon={<Users className="h-5 w-5" weight="regular" />} />
          </motion.div>

          {status.healthy ? (
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <EmptyState
                title="All clear"
                description={`No boundary violations and no foreign tenantId rows as of ${formatTime(status.checkedAt)}.`}
                icon={<Check className="h-8 w-8 text-pastel-green-600 dark:text-pastel-green-400" weight="bold" />}
              />
            </motion.div>
          ) : (
            <motion.div
              className="mt-8 space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              {status.violations.length > 0 ? (
                <Card variant="bezel">
                  <CardHeader>
                    <h3 className="text-heading-sm font-heading text-[var(--color-fg)]">Recent boundary violations</h3>
                    <Badge variant="red">{status.violations.length}</Badge>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {status.violations.map((v) => {
                      const detail = (v.detail ?? {}) as ViolationDetail;
                      const leaked = (detail.violations ?? [])
                        .map((x) => x.tenantId)
                        .filter(Boolean);
                      return (
                        <motion.div
                          key={v.id}
                          className="rounded-xl border border-[var(--color-border)] p-3"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-body-sm text-[var(--color-border-strong)]">
                              {detail.method ?? '?'} {detail.route ?? '(unknown route)'}
                            </span>
                            <Badge variant="blue">caller: {detail.expectedTenantId ?? v.tenantId}</Badge>
                            {leaked.map((t) => (
                              <Badge key={t} variant="red">leaked: {t}</Badge>
                            ))}
                          </div>
                          <p className="mt-1 text-caption text-[var(--color-border-strong)]">{formatTime(v.createdAt)}</p>
                        </motion.div>
                      );
                    })}
                  </CardBody>
                </Card>
              ) : null}

              {foreignEntries.length > 0 ? (
                <Card variant="bezel">
                  <CardHeader>
                    <h3 className="text-heading-sm font-heading text-[var(--color-fg)]">Foreign tenantId rows</h3>
                    <Badge variant="red">{foreignTotal}</Badge>
                  </CardHeader>
                  <CardBody>
                    <ul className="divide-y divide-[var(--color-border)]">
                      {foreignEntries.map(([table, count]) => (
                        <motion.li
                          key={table}
                          className="flex items-center justify-between py-2 text-body"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                        >
                          <span className="font-mono text-[var(--color-fg)]">{table}</span>
                          <span className="text-pastel-red-600 dark:text-pastel-red-400 font-medium">{count} row(s)</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ) : null}
            </motion.div>
          )}

          {status && (
            <motion.p
              className="mt-6 text-caption text-[var(--color-border-strong)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Checked at {formatTime(status.checkedAt)}
            </motion.p>
          )}
        </>
      )}
    </div>
  );
}
'use client';

import { useState } from 'react';
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
import { Check, ShieldCheck } from 'lucide-react';

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
      <PageHeader
        title="Tenant Isolation"
        description="System-wide cross-tenant leak detection (C6). Reads the audit trail and scans every tenant-scoped table."
        actions={
          <Button onClick={load} disabled={loading}>
            {loading ? 'Checking…' : status ? 'Refresh' : 'Load status'}
          </Button>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>
      ) : null}

      {!status ? (
        <EmptyState
          title="No scan loaded yet"
          description="Load the isolation status with your admin token to see boundary violations and foreign-row scan results."
          icon={<ShieldCheck className="h-8 w-8 text-brand-600 dark:text-brand-300" />}
          action={<Button onClick={load}>{loading ? 'Checking…' : 'Load status'}</Button>}
        />
      ) : (
        <>
          <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="Posture"
              value={status.healthy ? 'Healthy' : 'ALERT'}
              accent={status.healthy ? 'emerald' : 'danger'}
              hint={status.healthy ? 'No leaks detected' : 'Action required'}
            />
            <KpiCard
              label="Boundary violations"
              value={status.violations.length}
              accent={status.violations.length > 0 ? 'danger' : 'default'}
              hint="last 10 min"
            />
            <KpiCard
              label="Foreign rows"
              value={foreignTotal}
              accent={foreignTotal > 0 ? 'danger' : 'default'}
              hint="rows with unknown tenantId"
            />
            <KpiCard label="Tenants" value={status.tenants} hint="known tenantIds" />
          </div>

          {status.healthy ? (
            <div className="mt-8">
              <EmptyState
                title="All clear"
                description={`No boundary violations and no foreign tenantId rows as of ${formatTime(
                  status.checkedAt,
                )}.`}
                icon={<Check className="h-8 w-8 text-accent-600" />}
              />
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              {status.violations.length > 0 ? (
                <Card>
                  <CardHeader>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Recent boundary violations
                    </h3>
                    <Badge className="bg-red-100 text-danger dark:bg-red-950/50">
                      {status.violations.length}
                    </Badge>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {status.violations.map((v) => {
                      const detail = (v.detail ?? {}) as ViolationDetail;
                      const leaked = (detail.violations ?? [])
                        .map((x) => x.tenantId)
                        .filter(Boolean);
                      return (
                        <div
                          key={v.id}
                          className="rounded-xl border border-slate-100 p-3 text-sm dark:border-surface-border"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                              {detail.method ?? '?'} {detail.route ?? '(unknown route)'}
                            </span>
                            <Badge>caller: {detail.expectedTenantId ?? v.tenantId}</Badge>
                            {leaked.map((t) => (
                              <Badge key={t} className="bg-red-100 text-danger dark:bg-red-950/50">
                                leaked: {t}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{formatTime(v.createdAt)}</p>
                        </div>
                      );
                    })}
                  </CardBody>
                </Card>
              ) : null}

              {foreignEntries.length > 0 ? (
                <Card>
                  <CardHeader>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Foreign tenantId rows
                    </h3>
                    <Badge className="bg-red-100 text-danger dark:bg-red-950/50">{foreignTotal}</Badge>
                  </CardHeader>
                  <CardBody>
                    <ul className="divide-y divide-slate-100 dark:divide-surface-border">
                      {foreignEntries.map(([table, count]) => (
                        <li
                          key={table}
                          className="flex items-center justify-between py-2 text-sm"
                        >
                          <span className="font-mono text-slate-700">{table}</span>
                          <span className="text-danger">{count} row(s)</span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ) : null}
            </div>
          )}
        </>
      )}

      {status ? (
        <p className="mt-6 text-xs text-slate-400">Checked at {formatTime(status.checkedAt)}</p>
      ) : null}
    </div>
  );
}

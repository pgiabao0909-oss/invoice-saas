'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import type { Client, Invoice, InvoiceStatus } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { InvoiceTable } from '@/components/InvoiceTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

const FILTERS: { value: '' | InvoiceStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

export default function InvoicesPage() {
  const { tenant } = useTenant();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState<'' | InvoiceStatus>(() => {
    if (typeof window === 'undefined') return '';
    const q = new URLSearchParams(window.location.search).get('status');
    return (q === 'draft' || q === 'sent' || q === 'paid' || q === 'overdue' || q === 'void' ? q : '') as
      | ''
      | InvoiceStatus;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [inv, cl] = await Promise.all([
        api.listInvoices(status || undefined),
        api.listClients(),
      ]);
      if (active) {
        setInvoices(inv);
        setClients(cl);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant, status]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.legalName ?? id;

  if (!tenant) return null;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create, send, and track invoices."
        actions={
          <Link href="/invoices/new">
            <Button size="sm">+ New invoice</Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-slate-500">Filter</span>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | InvoiceStatus)}
          className="w-44 py-1.5"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Nothing here yet. Create an invoice to get started."
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
  );
}

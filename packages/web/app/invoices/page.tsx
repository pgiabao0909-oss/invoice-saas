'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Plus, FunnelSimple, CaretDown } from '@phosphor-icons/react';
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
    <div className="page-enter">
      {/* Editorial Split Layout */}
      <motion.div
        className="mb-8 grid gap-6 lg:grid-cols-[1fr_3fr]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Left: Editorial headline */}
        <div className="flex flex-col justify-center">
          <PageHeader
            title="Invoices"
            description="Create, send, and track invoices."
            actions={
              <Link href="/invoices/new">
                <Button size="sm" trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
                  New invoice
                </Button>
              </Link>
            }
          />
        </div>

        {/* Right: Filter + table */}
        <div className="flex flex-col gap-4">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
          >
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | InvoiceStatus)}
              className="w-48"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </motion.div>

          {loading ? (
            <motion.div
              className="py-10 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Spinner className="h-5 w-5 mx-auto" />
            </motion.div>
          ) : invoices.length === 0 ? (
            <EmptyState
              title="No invoices"
              description="Nothing here yet. Create an invoice to get started."
              action={
                <Link href="/invoices/new">
                  <Button size="sm" trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
                    New invoice
                  </Button>
                </Link>
              }
            />
          ) : (
            <motion.div
              className="overflow-x-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <InvoiceTable invoices={invoices} showClient clientName={clientName} />
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
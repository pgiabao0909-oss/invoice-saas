'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/components/TenantProvider';
import { api, ApiError } from '@/lib/api';
import type { Client } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Field } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

export default function ClientsPage() {
  const { tenant } = useTenant();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ legalName: '', email: '', billingAddress: '', taxIdentifier: '' });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!tenant) return;
    setLoading(true);
    setClients(await api.listClients());
    setLoading(false);
  }
  useEffect(() => {
    if (tenant) void load();
  }, [tenant]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const c = await api.createClient({
        legalName: form.legalName,
        email: form.email,
        billingAddress: form.billingAddress || undefined,
        taxIdentifier: form.taxIdentifier || undefined,
      });
      setClients((p) => [c, ...p]);
      setShow(false);
      setForm({ legalName: '', email: '', billingAddress: '', taxIdentifier: '' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create client');
    }
  }

  if (!tenant) return null;

  return (
    <div className="page-enter">
      <PageHeader
        title="Clients"
        description="People and companies you bill."
        actions={
          <Button size="sm" onClick={() => setShow(true)}>
            + New client
          </Button>
        }
      />

      {error ? (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>
      ) : null}

      {loading ? (
        <div className="py-10 text-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add a client to start invoicing them."
          action={
            <Button size="sm" onClick={() => setShow(true)}>
              + New client
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-surface-border dark:text-slate-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Tax ID</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-slate-50 dark:divide-surface-border">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-surface-muted/60">
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{c.legalName}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{c.email}</td>
                    <td className="px-5 py-3 text-slate-400 dark:text-slate-500">{c.taxIdentifier ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="New client"
        footer={
          <Button type="button" onClick={save}>
            Save client
          </Button>
        }
      >
        <form onSubmit={save} className="space-y-3">
          <Field label="Legal name">
            <Input
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Billing address">
            <Input
              value={form.billingAddress}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
            />
          </Field>
          <Field label="Tax ID">
            <Input
              value={form.taxIdentifier}
              onChange={(e) => setForm({ ...form, taxIdentifier: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

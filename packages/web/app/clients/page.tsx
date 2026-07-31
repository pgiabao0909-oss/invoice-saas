'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, User, Envelope, MapPin, Hash } from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api, ApiError } from '@/lib/api';
import type { Client } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        <PageHeader
          title="Clients"
          description="People and companies you bill."
          actions={
            <Button size="sm" onClick={() => setShow(true)} trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
              New client
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

      {loading ? (
        <motion.div className="py-10 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Spinner className="h-5 w-5 mx-auto" />
        </motion.div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add a client to start invoicing them."
          action={
            <Button size="sm" onClick={() => setShow(true)} trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
              New client
            </Button>
          }
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
        >
          {clients.map((c, index) => (
            <motion.article
              key={c.id}
              className="group relative rounded-[var(--radius-outer)] border border-[var(--color-border)] bg-[rgb(var(--surface-card))] p-6 shadow-bezel transition-all duration-300 ease-taste hover:-translate-y-0.5 hover:shadow-lift"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 + index * 0.05, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-fg)]">
                  <User className="h-5 w-5" weight="bold" />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <motion.h3 className="text-heading-sm font-heading text-[var(--color-fg)]" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                  {c.legalName}
                </motion.h3>
                <div className="flex items-center gap-2 text-body text-[var(--color-border-strong)]">
                  <Envelope className="h-4 w-4" weight="regular" />
                  {c.email}
                </div>
                {c.taxIdentifier && (
                  <div className="flex items-center gap-2 text-body text-[var(--color-border-strong)]">
                    <Hash className="h-4 w-4" weight="regular" />
                    <span>Tax ID: {c.taxIdentifier}</span>
                  </div>
                )}
                {c.billingAddress && (
                  <div className="flex items-center gap-2 text-body text-[var(--color-border-strong)]">
                    <MapPin className="h-4 w-4" weight="regular" />
                    <span>{c.billingAddress}</span>
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </motion.div>
      )}

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="New client"
        footer={
          <Button type="button" onClick={save} disabled={!form.legalName || !form.email}>
            Save client
          </Button>
        }
        size="md"
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Legal name">
            <Input
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              required
              autoFocus
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
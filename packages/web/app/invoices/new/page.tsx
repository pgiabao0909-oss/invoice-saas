'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Plus, X, Spinner } from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api, ApiError } from '@/lib/api';
import { computeTotals } from '@invoice-saas/contracts';
import type { Client, LineItem } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Field, MoneyInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { LineItemEditor } from '@/components/LineItemEditor';
import { formatMoney } from '@/lib/format';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export default function NewInvoicePage() {
  const { tenant } = useTenant();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPriceMinor: 0 },
  ]);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ legalName: '', email: '' });

  useEffect(() => {
    if (!tenant) return;
    setCurrency(tenant.baseCurrency);
    api.listClients().then(setClients);
  }, [tenant]);

  const totals = useMemo(
    () => computeTotals(items, [], discountMinor > 0 ? { amountMinor: discountMinor } : undefined),
    [items, discountMinor],
  );

  if (!tenant) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const inv = await api.createInvoice({
        clientId,
        currency,
        dueDate: new Date(dueDate).toISOString(),
        lineItems: items,
        discount: discountMinor > 0 ? { amountMinor: discountMinor } : undefined,
      });
      router.push(`/invoices/${inv.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setBusy(false);
    }
  }

  async function createClientInline(e: React.FormEvent) {
    e.preventDefault();
    try {
      const c = await api.createClient(newClient);
      setClients((prev) => [...prev, c]);
      setClientId(c.id);
      setShowClientModal(false);
      setNewClient({ legalName: '', email: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create client');
    }
  }

  const canSubmit = Boolean(clientId && dueDate && items.every((i) => i.description && i.quantity > 0));

  return (
    <div className="page-enter mx-auto max-w-3xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        <PageHeader
          title="New invoice"
          description="Pick a client, add line items, and we'll compute the totals."
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

      <form onSubmit={submit} className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
        >
          <Card variant="bezel">
            <CardBody className="space-y-6">
              <Field label="Client">
                <div className="flex gap-3">
                  <Select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Select a client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legalName}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowClientModal(true)}
                    trailingIcon={<Plus className="h-4 w-4" weight="bold" />}
                  >
                    New
                  </Button>
                </div>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Currency">
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due date">
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </Field>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          <Card variant="bezel">
            <CardBody className="space-y-4">
              <h3 className="text-heading-sm font-heading text-[var(--color-fg)]">Line items</h3>
              <LineItemEditor items={items} onChange={setItems} currency={currency} />
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          <Card variant="bezel">
            <CardBody className="space-y-6">
              <Field label="Discount (optional)">
                <MoneyInput
                  currency={currency}
                  valueMinor={discountMinor}
                  onChangeMinor={setDiscountMinor}
                />
              </Field>
              <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
                <motion.div
                  className="flex items-center justify-between"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
                >
                  <span className="text-body text-[var(--color-border-strong)]">Subtotal</span>
                  <span className="nums text-[var(--color-fg)] font-medium">{formatMoney(totals.subtotalMinor, currency)}</span>
                </motion.div>
                {totals.discountMinor > 0 && (
                  <motion.div
                    className="flex items-center justify-between"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <span className="text-body text-[var(--color-border-strong)]">Discount</span>
                    <span className="nums text-[var(--color-fg)] font-medium">
                      - {formatMoney(totals.discountMinor, currency)}
                    </span>
                  </motion.div>
                )}
                <motion.div
                  className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
                >
                  <span className="text-heading-sm font-heading text-[var(--color-fg)]">Total</span>
                  <AnimatedNumber value={totals.totalMinor} format={(n) => formatMoney(n, currency)} className="text-display-sm nums font-bold text-[var(--color-fg)]" />
                </motion.div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          <Button type="submit" size="lg" disabled={busy || !canSubmit} trailingIcon={busy ? <Spinner className="h-4 w-4 animate-spin" weight="bold" /> : undefined}>
            {busy ? 'Creating…' : 'Create invoice'}
          </Button>
        </motion.div>
      </form>

      <Modal
        open={showClientModal}
        onClose={() => setShowClientModal(false)}
        title="New client"
        footer={
          <Button type="button" onClick={createClientInline} disabled={!newClient.legalName || !newClient.email}>
            Save client
          </Button>
        }
        size="md"
      >
        <form onSubmit={createClientInline} className="space-y-4">
          <Field label="Legal name">
            <Input
              value={newClient.legalName}
              onChange={(e) => setNewClient({ ...newClient, legalName: e.target.value })}
              required
              autoFocus
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              required
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
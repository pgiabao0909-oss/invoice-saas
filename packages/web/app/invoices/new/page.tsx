'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  const totals = useMemo(() => computeTotals(items, []), [items]);

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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New invoice"
        description="Pick a client, add line items, and we'll compute the totals."
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <Field label="Client">
              <div className="flex gap-2">
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
                <Button type="button" variant="secondary" onClick={() => setShowClientModal(true)}>
                  + New
                </Button>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
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

        <Card>
          <CardBody className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
            <LineItemEditor items={items} onChange={setItems} currency={currency} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <Field label="Discount (optional)">
              <MoneyInput
                currency={currency}
                valueMinor={discountMinor}
                onChangeMinor={setDiscountMinor}
              />
            </Field>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">Total</span>
              <span className="nums text-lg font-semibold text-slate-900">
                {formatMoney(totals.totalMinor, currency)}
              </span>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? 'Creating…' : 'Create invoice'}
          </Button>
        </div>
      </form>

      <Modal
        open={showClientModal}
        onClose={() => setShowClientModal(false)}
        title="New client"
        footer={
          <Button type="button" onClick={createClientInline}>
            Save client
          </Button>
        }
      >
        <form onSubmit={createClientInline} className="space-y-3">
          <Field label="Legal name">
            <Input
              value={newClient.legalName}
              onChange={(e) => setNewClient({ ...newClient, legalName: e.target.value })}
              required
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

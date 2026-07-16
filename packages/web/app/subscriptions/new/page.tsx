'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/components/TenantProvider';
import { api, ApiError } from '@/lib/api';
import { computeTotals } from '@invoice-saas/contracts';
import type { Client, LineItem, SubscriptionInterval } from '@invoice-saas/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Field, MoneyInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { LineItemEditor } from '@/components/LineItemEditor';
import { formatMoney } from '@/lib/format';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const INTERVALS: SubscriptionInterval[] = ['day', 'week', 'month', 'year'];

export default function NewSubscriptionPage() {
  const { tenant } = useTenant();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPriceMinor: 0 },
  ]);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [intervalUnit, setIntervalUnit] = useState<SubscriptionInterval>('month');
  const [intervalCount, setIntervalCount] = useState(1);
  const [anchorDate, setAnchorDate] = useState('');
  const [netDays, setNetDays] = useState(14);
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
      await api.createSubscription({
        clientId,
        currency,
        lineItems: items,
        discount: discountMinor > 0 ? { amountMinor: discountMinor } : undefined,
        intervalUnit,
        intervalCount,
        anchorDate: anchorDate ? new Date(anchorDate).toISOString() : undefined,
        netDays,
      });
      router.push('/subscriptions');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to create subscription',
      );
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

  const canSubmit = Boolean(
    clientId && items.every((i) => i.description && i.quantity > 0) && intervalCount > 0,
  );

  return (
    <div className="page-enter mx-auto max-w-3xl">
      <PageHeader
        title="New subscription"
        description="Recurring billing schedule — we'll auto-generate and send an invoice every period."
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <Field label="Client">
              <div className="flex gap-2">
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="flex-1">
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

            <div className="grid grid-cols-3 gap-4">
              <Field label="Currency">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Billing every" hint="Count">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={intervalCount}
                  onChange={(e) => setIntervalCount(parseInt(e.target.value || '1', 10))}
                />
              </Field>
              <Field label="Interval">
                <Select
                  value={intervalUnit}
                  onChange={(e) => setIntervalUnit(e.target.value as SubscriptionInterval)}
                >
                  {INTERVALS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="First charge date" hint="Defaults to 30 days out if blank">
                <Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
              </Field>
              <Field label="Net terms (days)" hint="Days from generation to due">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={netDays}
                  onChange={(e) => setNetDays(parseInt(e.target.value || '14', 10))}
                />
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
              <MoneyInput currency={currency} valueMinor={discountMinor} onChangeMinor={setDiscountMinor} />
            </Field>
            <div className="space-y-1 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="nums text-slate-800">{formatMoney(totals.subtotalMinor, currency)}</span>
              </div>
              {totals.discountMinor > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Discount</span>
                  <span className="nums text-slate-800">- {formatMoney(totals.discountMinor, currency)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-slate-700">Charged each period</span>
                <span className="nums text-lg font-semibold text-slate-900">
                  {formatMoney(totals.totalMinor, currency)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? 'Creating…' : 'Create subscription'}
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

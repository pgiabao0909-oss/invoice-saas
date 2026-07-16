'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';
import { Check } from 'lucide-react';

export default function SettingsPage() {
  const { tenant, refresh } = useTenant();
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1E3A5F');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tenant) {
      setDisplayName(tenant.branding?.displayName ?? tenant.name);
      setLogoUrl(tenant.branding?.logoUrl ?? '');
      setPrimaryColor(tenant.branding?.primaryColor ?? '#1E3A5F');
    }
  }, [tenant]);

  if (!tenant) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const branding: { displayName: string; primaryColor: string; logoUrl?: string } = {
      displayName,
      primaryColor,
    };
    if (logoUrl) branding.logoUrl = logoUrl;
    await api.updateBranding(branding);
    await refresh();
    setBusy(false);
    setSaved(true);
  }

  return (
    <div className="page-enter mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Branding for your invoices and emails." />

      <form onSubmit={save}>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-slate-700">Branding</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Logo URL">
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Primary color">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 rounded-lg border border-surface-border"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32"
                />
              </div>
            </Field>

            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Live preview</p>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ background: primaryColor }}
                >
                  {displayName.charAt(0).toUpperCase() || 'I'}
                </div>
                <span className="font-semibold text-slate-800">{displayName || tenant.name}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-sm text-accent-700">
              <Check className="h-4 w-4" />
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { api, setTenantSlug } from '@/lib/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Field } from './ui/Field';
import { useTenant } from './TenantProvider';

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function Onboarding() {
  const { refresh, tenants } = useTenant();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await api.createTenant({ name, slug: slugify(slug || name) });
      setTenantSlug(t.slug);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setBusy(false);
    }
  }

  async function pick(s: string) {
    setTenantSlug(s);
    await refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient p-6">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <div className="text-sm font-medium text-brand-600">Get started</div>
          <h1 className="text-xl font-semibold text-slate-900">Create your workspace</h1>
          <p className="mt-1 text-sm text-slate-500">
            Workspaces keep invoices, clients, and branding isolated per tenant.
          </p>

          {tenants.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Or sign in to an existing workspace
              </p>
              <div className="flex flex-wrap gap-2">
                {tenants.map((t) => (
                  <Button key={t.id} variant="secondary" size="sm" onClick={() => pick(t.slug)}>
                    {t.branding?.displayName ?? t.name}
                  </Button>
                ))}
              </div>
              <div className="my-5 border-t border-slate-100" />
            </div>
          ) : null}

          <form onSubmit={create} className="space-y-3">
            <Field label="Workspace name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </Field>
            <Field label="Slug" hint="Used by the API as the x-tenant-slug header.">
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder={slugify(name) || 'acme'}
                required
              />
            </Field>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit" disabled={busy || !name} className="w-full">
              {busy ? 'Creating…' : 'Create workspace'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Building, ArrowRight } from '@phosphor-icons/react';
import { api, setTenantSlug } from '@/lib/api';
import { Card, CardBody } from './ui/Card';
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
    <motion.div
      className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-100 p-6 dark:from-darkStone-950 dark:via-darkStone-900 dark:to-darkStone-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
      >
        <Card variant="bezel">
          <CardBody className="p-8 space-y-8">
            {/* Header */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius-inner)] bg-gradient-to-br from-stone-700 to-stone-900 text-white">
                <Building className="h-7 w-7" weight="bold" />
              </div>
              <h1 className="text-display-sm font-heading tracking-tight text-[var(--color-fg)]">Create your workspace</h1>
              <p className="mt-2 text-body text-[var(--color-border-strong)]">
                Workspaces keep invoices, clients, and branding isolated per tenant.
              </p>
            </motion.div>

            {/* Existing tenants */}
            {tenants.length > 0 && (
              <motion.div
                className="rounded-xl border border-[var(--color-border)] p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
              >
                <p className="mb-3 text-caption text-[var(--color-border-strong)]">Or switch to existing workspace</p>
                <div className="flex flex-wrap gap-2">
                  {tenants.map((t) => (
                    <motion.button
                      key={t.id}
                      type="button"
                      onClick={() => pick(t.slug)}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {t.branding?.displayName ?? t.name}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Create form */}
            <motion.form
              onSubmit={create}
              className="space-y-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: tenants.length > 0 ? 0.4 : 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <Field label="Workspace name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Inc."
                  required
                  autoFocus
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
              {error && (
                <motion.p
                  className="text-body text-pastel-red-600 dark:text-pastel-red-400"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
              <Button type="submit" disabled={busy || !name} className="w-full" size="lg" trailingIcon={<ArrowRight className="h-4 w-4" weight="bold" />}>
                {busy ? 'Creating…' : 'Create workspace'}
              </Button>
            </motion.form>
          </CardBody>
        </Card>

        <motion.p
          className="mt-6 text-center text-caption text-[var(--color-border-strong)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Invoice SaaS — Automated invoicing at scale
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
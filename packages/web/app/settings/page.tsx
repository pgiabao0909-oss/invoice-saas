'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Palette, Image, TextAa, Check } from '@phosphor-icons/react';
import { useTenant } from '@/components/TenantProvider';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';

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
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="page-enter mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        <PageHeader title="Settings" description="Branding for your invoices and emails." />
      </motion.div>

      <motion.form
        onSubmit={save}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
      >
        <Card variant="bezel">
          <CardHeader>
            <h3 className="flex items-center gap-2 text-heading-sm font-heading text-[var(--color-fg)]">
              <TextAa className="h-5 w-5" weight="bold" />
              Branding
            </h3>
          </CardHeader>
          <CardBody className="space-y-6">
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Logo URL">
              <div className="relative">
                <Image className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-border-strong)]" weight="regular" />
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…"
                  className="pl-12"
                />
              </div>
            </Field>
            <Field label="Primary color">
              <div className="flex items-center gap-3">
                <motion.div
                  className="relative flex h-10 w-12 items-center justify-center rounded-lg border border-[var(--color-border)] overflow-hidden"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
                >
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Primary color picker"
                  />
                  <Palette className="h-5 w-5 text-[var(--color-border-strong)]" weight="regular" />
                  <div className="absolute inset-0" style={{ background: primaryColor }} />
                </motion.div>
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 font-mono text-sm"
                />
              </div>
            </Field>

            {/* Live preview */}
            <motion.div
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <p className="text-caption text-[var(--color-border-strong)]">Live preview</p>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ background: primaryColor }}
                >
                  {displayName.charAt(0).toUpperCase() || 'I'}
                </div>
                <span className="font-semibold text-[var(--color-fg)]">{displayName || tenant.name}</span>
              </div>
            </motion.div>
          </CardBody>
        </Card>

        <motion.div
          className="mt-6 flex items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          <Button type="submit" size="lg" disabled={busy} trailingIcon={busy ? undefined : undefined}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
          {saved && (
            <motion.span
              className="inline-flex items-center gap-1 text-body text-pastel-green-600 dark:text-pastel-green-400"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Check className="h-4 w-4" weight="bold" />
              Saved
            </motion.span>
          )}
        </motion.div>
      </motion.form>
    </div>
  );
}
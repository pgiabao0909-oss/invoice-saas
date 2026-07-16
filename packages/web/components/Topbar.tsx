'use client';

import Link from 'next/link';
import { useTenant } from './TenantProvider';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

export function Topbar() {
  const { tenants, slug, switchTenant } = useTenant();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-white/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-slate-400 sm:inline">Workspace</span>
        {tenants.length > 0 ? (
          <Select
            value={slug ?? ''}
            onChange={(e) => switchTenant(e.target.value)}
            className="w-48 py-1.5"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.branding?.displayName ?? t.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <Link href="/invoices/new">
        <Button size="sm">+ New invoice</Button>
      </Link>
    </header>
  );
}

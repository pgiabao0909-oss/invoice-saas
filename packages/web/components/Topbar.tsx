'use client';

import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useTenant } from './TenantProvider';
import { useTheme } from './ThemeProvider';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

export function Topbar() {
  const { tenants, slug, switchTenant } = useTenant();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-surface-bg/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-slate-400 dark:text-slate-500 sm:inline">Workspace</span>
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

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
          className="px-2.5"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Link href="/invoices/new">
          <Button size="sm">+ New invoice</Button>
        </Link>
      </div>
    </header>
  );
}

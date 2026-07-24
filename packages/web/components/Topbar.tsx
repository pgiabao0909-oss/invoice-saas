'use client';

import Link from 'next/link';
import { Menu, Moon, Plus, Sun } from 'lucide-react';
import { useTenant } from './TenantProvider';
import { useTheme } from './ThemeProvider';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { tenants, slug, switchTenant } = useTenant();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-surface-border bg-surface-bg/80 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-muted md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="hidden text-sm text-slate-400 dark:text-slate-500 sm:inline">Workspace</span>
        {tenants.length > 0 ? (
          <Select
            value={slug ?? ''}
            onChange={(e) => switchTenant(e.target.value)}
            className="w-44 py-1.5"
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
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
        <Link href="/invoices/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New invoice
          </Button>
        </Link>
      </div>
    </header>
  );
}

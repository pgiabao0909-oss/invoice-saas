'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { List, Moon, Plus, Sun } from '@phosphor-icons/react';
import { useTenant } from './TenantProvider';
import { useTheme } from './ThemeProvider';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { tenants, slug, switchTenant } = useTenant();
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[rgb(var(--surface-card))]/80 px-4 py-3 backdrop-blur sm:px-6"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="rounded-lg p-2 text-[var(--color-border-strong)] hover:bg-[var(--color-muted)] transition-colors md:hidden"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <List className="h-5 w-5" weight="regular" />
        </motion.button>
        <span className="hidden text-caption text-[var(--color-border-strong)] sm:inline">Workspace</span>
        {tenants.length > 0 ? (
          <Select
            value={slug ?? ''}
            onChange={(e) => switchTenant(e.target.value)}
            className="w-44"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.branding?.displayName ?? t.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <motion.div className="flex items-center gap-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}>
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="rounded-lg p-2 text-[var(--color-border-strong)] hover:bg-[var(--color-muted)] transition-colors"
        >
          {theme === 'dark' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}>
              <Sun className="h-5 w-5" weight="regular" />
            </motion.div>
          ) : (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}>
              <Moon className="h-5 w-5" weight="regular" />
            </motion.div>
          )}
        </button>
        <Link href="/invoices/new">
          <Button size="sm" trailingIcon={<Plus className="h-4 w-4" weight="bold" />}>
            New invoice
          </Button>
        </Link>
      </motion.div>
    </motion.header>
  );
}
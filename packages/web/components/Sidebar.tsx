'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import {
  Layout,
  FileText,
  ArrowCounterClockwise,
  Users,
  ShieldCheck,
  Gear,
} from '@phosphor-icons/react';
import { useTenant } from './TenantProvider';

const nav: { href: string; label: string; icon: typeof Layout }[] = [
  { href: '/', label: 'Dashboard', icon: Layout },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/subscriptions', label: 'Subscriptions', icon: ArrowCounterClockwise },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/isolation', label: 'Isolation', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Gear },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const initial = (tenant?.branding?.displayName ?? tenant?.name ?? 'I').charAt(0).toUpperCase();
  const name = tenant?.branding?.displayName ?? tenant?.name ?? 'Invoice SaaS';

  return (
    <aside className="hidden md:flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[rgb(var(--surface-card))]">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 text-lg font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--color-fg)]">{name}</div>
          <div className="text-xs text-[var(--color-border-strong)]">Workspace</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item, index) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <motion.div key={item.href} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 + index * 0.05, ease: [0.32, 0.72, 0, 1] }}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={clsx(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-taste',
                  active
                    ? 'bg-[var(--color-muted)] text-[var(--color-fg)]'
                    : 'text-[var(--color-border-strong)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]',
                )}
              >
                <motion.div
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-fg)]"
                  initial={active ? { scaleY: 0 } : { scaleY: 0 }}
                  animate={active ? { scaleY: 1 } : { scaleY: 0 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                />
                <motion.span
                  className={clsx('h-5 w-5 flex items-center justify-center transition-transform duration-200 ease-taste group-hover:scale-110', active && 'text-[var(--color-fg)]')}
                  whileHover={{ scale: 1.1 }}
                >
                  <Icon className="h-5 w-5" weight={active ? 'bold' : 'regular'} strokeWidth={active ? 2.5 : 2} />
                </motion.span>
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-caption text-[var(--color-border-strong)] border-t border-[var(--color-border)]">
        Invoice SaaS · hybrid tenancy
      </div>
    </aside>
  );
}
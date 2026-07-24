'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LayoutDashboard, FileText, RefreshCw, Users, ShieldCheck, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTenant } from './TenantProvider';

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/isolation', label: 'Isolation', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const initial = (tenant?.branding?.displayName ?? tenant?.name ?? 'I').charAt(0).toUpperCase();
  const name = tenant?.branding?.displayName ?? tenant?.name ?? 'Invoice SaaS';

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-surface-border bg-surface-bg">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cta-gradient text-lg font-bold text-white shadow-cta-sm">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900 dark:text-surface-fg">{name}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Workspace</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-soft',
                active
                  ? 'bg-cta-50 text-cta-700 dark:bg-cta-900/30 dark:text-cta-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-surface-muted dark:hover:text-surface-fg',
              )}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-cta-600" />
              ) : null}
              <Icon
                className={clsx(
                  'h-[18px] w-[18px] transition-transform duration-200 ease-spring group-hover:scale-110',
                  active ? 'text-cta-600 dark:text-cta-300' : '',
                )}
                strokeWidth={2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-400 dark:text-slate-500">Invoice SaaS · hybrid tenancy</div>
    </div>
  );
}

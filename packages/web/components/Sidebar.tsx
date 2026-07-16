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

export function Sidebar() {
  const pathname = usePathname();
  const { tenant } = useTenant();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border bg-white md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
          {(tenant?.branding?.displayName ?? tenant?.name ?? 'I').charAt(0).toUpperCase()}
        </div>
        <div className="truncate text-sm font-semibold text-slate-900">
          {tenant?.branding?.displayName ?? tenant?.name ?? 'Invoice SaaS'}
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
              className={clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ease-soft',
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className="h-[18px] w-[18px] transition-transform duration-200 ease-soft group-hover:scale-110" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-400">Invoice SaaS · hybrid tenancy</div>
    </aside>
  );
}

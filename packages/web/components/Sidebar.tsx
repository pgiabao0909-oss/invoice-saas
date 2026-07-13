'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTenant } from './TenantProvider';

const nav = [
  { href: '/', label: 'Dashboard', icon: '◧' },
  { href: '/invoices', label: 'Invoices', icon: '⎙' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '↻' },
  { href: '/clients', label: 'Clients', icon: '◭' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { tenant } = useTenant();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-white">
          {(tenant?.branding?.displayName ?? tenant?.name ?? 'I').charAt(0).toUpperCase()}
        </div>
        <div className="truncate text-sm font-semibold text-slate-900">
          {tenant?.branding?.displayName ?? tenant?.name ?? 'Invoice SaaS'}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-brand-gradient text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <span className="text-base leading-none opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-400">Invoice SaaS · hybrid tenancy</div>
    </aside>
  );
}

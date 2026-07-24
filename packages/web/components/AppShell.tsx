'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useTenant } from './TenantProvider';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Onboarding } from './Onboarding';
import { FullScreenLoader } from './ui/Spinner';

export function AppShell({ children }: { children: ReactNode }) {
  const { tenant, ready } = useTenant();
  const [navOpen, setNavOpen] = useState(false);

  if (!ready) return <FullScreenLoader />;
  if (!tenant) return <Onboarding />;

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Mobile slide-in drawer */}
      <div className={clsx('fixed inset-0 z-40 md:hidden', navOpen ? '' : 'pointer-events-none')}>
        <div
          className={clsx(
            'absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300',
            navOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={clsx(
            'absolute left-0 top-0 h-full shadow-xl transition-transform duration-300 ease-soft',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-7 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

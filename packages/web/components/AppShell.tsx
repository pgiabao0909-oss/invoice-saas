'use client';

import type { ReactNode } from 'react';
import { useTenant } from './TenantProvider';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Onboarding } from './Onboarding';
import { FullScreenLoader } from './ui/Spinner';

export function AppShell({ children }: { children: ReactNode }) {
  const { tenant, ready } = useTenant();

  if (!ready) return <FullScreenLoader />;
  if (!tenant) return <Onboarding />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import './globals.css';
import { TenantProvider } from '@/components/TenantProvider';
import { AppShell } from '@/components/AppShell';

export const metadata = {
  title: 'Invoice SaaS',
  description: 'Scalable, multi-tenant invoice platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TenantProvider>
          <AppShell>{children}</AppShell>
        </TenantProvider>
      </body>
    </html>
  );
}

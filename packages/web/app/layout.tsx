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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Calistoga:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <TenantProvider>
          <AppShell>{children}</AppShell>
        </TenantProvider>
      </body>
    </html>
  );
}

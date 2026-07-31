import type { ReactNode } from 'react';
import './globals.css';
import { geistSans, geistMono, lyonText } from '@/app/fonts';
import { TenantProvider } from '@/components/TenantProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppShell } from '@/components/AppShell';

export const metadata = {
  title: 'Invoice SaaS',
  description: 'Scalable, multi-tenant invoice platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${lyonText.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider>
          <TenantProvider>
            <AppShell>{children}</AppShell>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
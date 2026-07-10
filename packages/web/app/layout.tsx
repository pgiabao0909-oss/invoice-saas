import type { ReactNode } from 'react';

export const metadata = {
  title: 'Invoice SaaS',
  description: 'Scalable, multi-tenant invoice platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

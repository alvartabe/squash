import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { resolveLocale } from '@squash/i18n';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/src/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Squash Admin',
  description: 'Club and tournament administration',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = resolveLocale((await cookies()).get('squash-locale')?.value);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <Providers locale={locale}>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}

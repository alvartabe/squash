'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/src/locale-provider';
import { playerAuthClient } from '@/src/lib/auth-client';

export function SecurityOnboardingLogin() {
  const { t } = useLocale();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('security.onboardingHeading')}</CardTitle>
          <CardDescription>{t('security.onboardingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                playerAuthClient.signIn.social({ provider: 'google', callbackURL: '/security' })
              }
            >
              {t('auth.google')}
            </Button>
          )}
          {process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === 'true' && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                playerAuthClient.signIn.social({ provider: 'apple', callbackURL: '/security' })
              }
            >
              {t('auth.apple')}
            </Button>
          )}
          <Button asChild className="w-full">
            <Link href="/login?callbackURL=/security">{t('security.useCredential')}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

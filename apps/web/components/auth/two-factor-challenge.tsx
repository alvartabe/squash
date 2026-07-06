'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/src/locale-provider';
import { managementAuthClient } from '@/src/lib/auth-client';
import { internalCallbackPath } from '@/src/lib/internal-redirect';

type Method = 'totp' | 'backup';

function challengeError(code: string | undefined, status?: number) {
  if (status === 429) return 'security.tooManyAttempts' as const;
  if (code === 'INVALID_TWO_FACTOR_COOKIE') return 'security.challengeExpired' as const;
  if (code === 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE') {
    return 'security.tooManyAttempts' as const;
  }
  if (code === 'INVALID_BACKUP_CODE') return 'security.invalidBackupCode' as const;
  return 'security.invalidCode' as const;
}

export function TwoFactorChallenge() {
  const { t } = useLocale();
  const router = useRouter();
  const [method, setMethod] = useState<Method>('totp');
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [errorKey, setErrorKey] = useState<ReturnType<typeof challengeError> | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    setErrorKey(null);
    const result =
      method === 'totp'
        ? await managementAuthClient.twoFactor.verifyTotp({ code, trustDevice })
        : await managementAuthClient.twoFactor.verifyBackupCode({ code, trustDevice });
    if (result.error) {
      setErrorKey(challengeError(result.error.code, result.error.status));
      setBusy(false);
      return;
    }
    const callbackURL = internalCallbackPath(sessionStorage.getItem('squash.management.callback'));
    sessionStorage.removeItem('squash.management.callback');
    router.replace(callbackURL);
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('security.challengeHeading')}</CardTitle>
          <CardDescription>{t('security.challengeDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={method === 'totp' ? 'default' : 'outline'}
              onClick={() => {
                setMethod('totp');
                setCode('');
                setErrorKey(null);
              }}
            >
              {t('security.authenticatorCode')}
            </Button>
            <Button
              type="button"
              variant={method === 'backup' ? 'default' : 'outline'}
              onClick={() => {
                setMethod('backup');
                setCode('');
                setErrorKey(null);
              }}
            >
              {t('security.backupCode')}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="challenge-code">
              {method === 'totp' ? t('security.totpCode') : t('security.backupCode')}
            </Label>
            <Input
              id="challenge-code"
              inputMode={method === 'totp' ? 'numeric' : 'text'}
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              className="mt-1 size-4"
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{t('security.trustDevice')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('security.trustDeviceWarning')}
              </span>
            </span>
          </label>
          {errorKey && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorKey)}
            </p>
          )}
          <Button className="w-full" disabled={busy || !code} onClick={verify}>
            {t('security.verifyChallenge')}
          </Button>
          {errorKey === 'security.challengeExpired' && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">{t('security.signInAgain')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

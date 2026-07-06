'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/src/locale-provider';
import { managementAuthClient } from '@/src/lib/auth-client';

type SecurityStage = 'password' | 'enroll' | 'enabled';

function manualSecret(totpURI: string | null) {
  if (!totpURI) return '';
  try {
    return new URL(totpURI).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

function BackupCodes({ codes }: { codes: string[] }) {
  const { t } = useLocale();
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="font-medium">{t('security.backupCodesHeading')}</p>
      <p className="text-sm">{t('security.backupCodesDescription')}</p>
      <ul
        className="grid grid-cols-2 gap-2 font-mono text-sm"
        aria-label={t('security.backupCodesHeading')}
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}

export function SecuritySetup({ email, stage }: { email: string; stage: SecurityStage }) {
  const { t } = useLocale();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const secret = useMemo(() => manualSecret(totpURI), [totpURI]);

  const setupPassword = async () => {
    if (password.length < 8 || password !== confirmation) {
      toast.error(t('security.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/security/set-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!response.ok) throw new Error('password setup failed');
      toast.success(t('security.passwordCreated'));
      router.push('/login?callbackURL=/security');
      router.refresh();
    } catch {
      toast.error(t('security.passwordError'));
    } finally {
      setBusy(false);
    }
  };

  const beginEnrollment = async () => {
    setBusy(true);
    try {
      const result = await managementAuthClient.twoFactor.enable({
        password,
        issuer: 'Squash',
      });
      if (result.error || !result.data) throw new Error(result.error?.code);
      setTotpURI(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setPassword('');
    } catch {
      toast.error(t('security.passwordError'));
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async () => {
    setBusy(true);
    try {
      const result = await managementAuthClient.twoFactor.verifyTotp({
        code,
        trustDevice: false,
      });
      if (result.error) throw new Error(result.error.code);
      setVerified(true);
      setCode('');
    } catch {
      toast.error(t('security.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setBusy(true);
    try {
      const result = await managementAuthClient.twoFactor.generateBackupCodes({ password });
      if (result.error || !result.data) throw new Error(result.error?.code);
      setBackupCodes(result.data.backupCodes);
      setPassword('');
    } catch {
      toast.error(t('security.passwordError'));
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async () => {
    setBusy(true);
    try {
      const result = await managementAuthClient.twoFactor.disable({ password });
      if (result.error) throw new Error(result.error.code);
      setPassword('');
      toast.success(t('security.disabled'));
      router.push('/login?callbackURL=/security');
      router.refresh();
    } catch {
      toast.error(t('security.passwordError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{t('security.heading')}</CardTitle>
          <CardDescription>
            {t('security.description')} {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stage === 'password' && (
            <>
              <p className="text-sm">{t('security.credentialRequired')}</p>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('security.newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('security.confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
              <Button disabled={busy} onClick={setupPassword}>
                {t('security.createPassword')}
              </Button>
            </>
          )}

          {stage === 'enroll' && !totpURI && (
            <>
              <p className="text-sm">{t('security.enrollmentRequired')}</p>
              <div className="space-y-2">
                <Label htmlFor="enrollment-password">{t('auth.password')}</Label>
                <Input
                  id="enrollment-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button disabled={busy || !password} onClick={beginEnrollment}>
                {t('security.beginEnrollment')}
              </Button>
            </>
          )}

          {stage === 'enroll' && totpURI && !verified && (
            <>
              <p className="text-sm">{t('security.scanInstructions')}</p>
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={totpURI} size={220} title={t('security.qrTitle')} />
              </div>
              <div className="space-y-2">
                <Label>{t('security.manualKey')}</Label>
                <p className="break-all rounded-md bg-muted p-3 font-mono text-sm">{secret}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment-code">{t('security.totpCode')}</Label>
                <Input
                  id="enrollment-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <Button disabled={busy || !code} onClick={verifyEnrollment}>
                {t('security.verifyEnrollment')}
              </Button>
            </>
          )}

          {stage === 'enroll' && verified && (
            <>
              <BackupCodes codes={backupCodes} />
              <p className="text-sm font-medium">{t('security.freshLoginRequired')}</p>
              <Button asChild>
                <Link href="/login?callbackURL=/workspace">{t('security.signInAgain')}</Link>
              </Button>
            </>
          )}

          {stage === 'enabled' && (
            <>
              <p className="rounded-lg bg-brand-soft p-4 text-sm text-primary">
                {t('security.enabled')}
              </p>
              {backupCodes.length > 0 && <BackupCodes codes={backupCodes} />}
              <div className="space-y-2">
                <Label htmlFor="security-password">{t('auth.password')}</Label>
                <Input
                  id="security-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={busy || !password}
                  onClick={regenerateBackupCodes}
                >
                  {t('security.regenerateBackupCodes')}
                </Button>
                <Button variant="destructive" disabled={busy || !password} onClick={disableMfa}>
                  {t('security.disable')}
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/workspace">{t('security.returnToWorkspace')}</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

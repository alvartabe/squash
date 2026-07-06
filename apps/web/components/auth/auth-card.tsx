'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/src/locale-provider';
import { managementAuthClient, playerAuthClient } from '@/src/lib/auth-client';
import { TurnstileWidget } from './turnstile-widget';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
type AuthenticationBoundary = 'management' | 'player';

export function AuthCard({
  mode,
  callbackURL = '/workspace',
  authenticationBoundary = 'management',
  token,
}: {
  mode: Mode;
  callbackURL?: string;
  authenticationBoundary?: AuthenticationBoundary;
  token?: string | undefined;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [complete, setComplete] = useState(false);
  const [resending, setResending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const schema = z.object({
    name: mode === 'signup' ? z.string().trim().min(1) : z.string().optional(),
    email: mode === 'reset' ? z.string().optional() : z.email(),
    password: mode === 'forgot' ? z.string().optional() : z.string().min(8),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const title =
    mode === 'login'
      ? t('auth.heading')
      : mode === 'signup'
        ? t('auth.signUpHeading')
        : mode === 'forgot'
          ? t('auth.forgotHeading')
          : t('auth.resetHeading');

  const submit = form.handleSubmit(async (values) => {
    if ((mode === 'login' || mode === 'signup') && turnstileSiteKey && !turnstileToken) {
      toast.error(t('auth.turnstileRequired'));
      return;
    }
    const requestOptions = turnstileToken
      ? { headers: { 'x-turnstile-token': turnstileToken } }
      : undefined;
    if (mode === 'login') {
      const credentials = {
        email: values.email ?? '',
        password: values.password ?? '',
      };
      if (authenticationBoundary === 'management') {
        sessionStorage.setItem('squash.management.callback', callbackURL);
      }
      const result =
        authenticationBoundary === 'management'
          ? await managementAuthClient.signIn.email(credentials, requestOptions)
          : await playerAuthClient.signIn.email({ ...credentials, callbackURL }, requestOptions);
      if (result.error) return toast.error(t('auth.error'));
      if (
        authenticationBoundary === 'management' &&
        result.data &&
        'twoFactorRedirect' in result.data
      ) {
        return;
      }
      router.push(callbackURL);
      router.refresh();
      return;
    }
    if (mode === 'signup') {
      const result = await playerAuthClient.signUp.email(
        {
          name: values.name ?? '',
          email: values.email ?? '',
          password: values.password ?? '',
          callbackURL,
          locale: document.documentElement.lang,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        requestOptions,
      );
      if (result.error) return toast.error(t('auth.error'));
      setComplete(true);
      return;
    }
    if (mode === 'forgot') {
      const result = await playerAuthClient.requestPasswordReset({
        email: values.email ?? '',
        redirectTo: '/reset-password',
      });
      if (result.error) return toast.error(t('auth.error'));
      setComplete(true);
      return;
    }
    const result = await playerAuthClient.resetPassword({
      newPassword: values.password ?? '',
      token,
    });
    if (result.error) return toast.error(t('auth.error'));
    toast.success(t('email.reset.subject'));
    router.push('/login');
  });

  const resendVerification = async () => {
    const email = form.getValues('email') ?? '';
    if (!z.email().safeParse(email).success) {
      toast.error(t('error.invalidRequest'));
      return;
    }
    setResending(true);
    try {
      const result = await playerAuthClient.sendVerificationEmail({ email, callbackURL });
      if (result.error) throw new Error(result.error.message);
      toast.success(t('auth.verificationResent'));
    } catch {
      toast.error(t('auth.error'));
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="mb-4 flex items-center gap-2 font-bold text-primary">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              S
            </span>
            {t('app.name')}
          </Link>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {mode === 'forgot' && <CardDescription>{t('auth.forgotDescription')}</CardDescription>}
        </CardHeader>
        <CardContent>
          {complete ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-brand-soft p-4 text-sm text-primary">
                {t('auth.checkEmail')}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">{t('auth.signIn')}</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">{t('auth.name')}</Label>
                  <Input id="name" autoComplete="name" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
              )}
              {mode !== 'reset' && (
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
              )}
              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">
                      {mode === 'reset' ? t('auth.newPassword') : t('auth.password')}
                    </Label>
                    {mode === 'login' && (
                      <Link
                        className="text-xs text-primary hover:underline"
                        href="/forgot-password"
                      >
                        {t('auth.forgotPassword')}
                      </Link>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    {...form.register('password')}
                  />
                  <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>
              )}
              {(mode === 'login' || mode === 'signup') && turnstileSiteKey && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('auth.turnstileTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('auth.turnstileDescription')}</p>
                  <TurnstileWidget siteKey={turnstileSiteKey} onChange={setTurnstileToken} />
                </div>
              )}
              <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
                {mode === 'login'
                  ? t('auth.signIn')
                  : mode === 'signup'
                    ? t('auth.signUp')
                    : mode === 'forgot'
                      ? t('auth.sendReset')
                      : t('auth.resetPassword')}
              </Button>
              {mode === 'login' && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={resending}
                  onClick={resendVerification}
                >
                  {t('auth.resendVerification')}
                </Button>
              )}
              {(mode === 'login' || mode === 'signup') && (
                <p className="text-center text-sm text-muted-foreground">
                  {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={
                      mode === 'login'
                        ? `/signup?callbackURL=${encodeURIComponent(callbackURL)}`
                        : `/login?callbackURL=${encodeURIComponent(callbackURL)}`
                    }
                  >
                    {mode === 'login' ? t('auth.signUp') : t('auth.signIn')}
                  </Link>
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

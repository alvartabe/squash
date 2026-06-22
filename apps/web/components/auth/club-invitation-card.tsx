'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { authClient } from '@/src/lib/auth-client';
import { api } from '@/src/lib/api';
import { useLocale } from '@/src/locale-provider';

type InvitationView = {
  clubId: string;
  clubName: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
};

export function ClubInvitationCard({ token }: { token: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const session = authClient.useSession();
  const invitation = useQuery<InvitationView>({
    queryKey: ['club-invitation', token],
    queryFn: async () => (await api.get(`/club-invitations/${token}`)).data.data,
    retry: false,
  });
  const accept = useMutation({
    mutationFn: async () =>
      (await api.post(`/club-invitations/${token}/accept`)).data.data as { clubId: string },
    onSuccess: (data) => {
      toast.success(t('invitation.accepted'));
      router.push(`/workspace/clubs/${data.clubId}`);
      router.refresh();
    },
    onError: () => toast.error(t('error.invalidRequest')),
  });
  const callbackURL = `/club-invitations/${token}`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Link href="/" className="mb-4 font-bold text-primary">
            {t('app.name')}
          </Link>
          <CardTitle className="text-2xl">{t('invitation.heading')}</CardTitle>
          <CardDescription>{t('invitation.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {invitation.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : invitation.data ? (
            <>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{invitation.data.clubName}</p>
                  <Badge variant={invitation.data.status === 'pending' ? 'default' : 'secondary'}>
                    {invitation.data.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {invitation.data.email} · {invitation.data.role}
                </p>
              </div>
              {invitation.data.status !== 'pending' ? (
                <p className="text-sm text-muted-foreground">{t('invitation.unavailable')}</p>
              ) : session.data ? (
                <Button
                  className="w-full"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  {t('invitation.accept')}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t('invitation.signIn')}</p>
                  <Button asChild className="w-full">
                    <Link href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`}>
                      {t('auth.signIn')}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/signup?callbackURL=${encodeURIComponent(callbackURL)}`}>
                      {t('auth.signUp')}
                    </Link>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-destructive">{t('invitation.unavailable')}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

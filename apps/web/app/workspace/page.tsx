'use client';

import Link from 'next/link';
import { ArrowRight, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspaceMe } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

export default function WorkspacePage() {
  const { data, isLoading } = useWorkspaceMe();
  const { t } = useLocale();
  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('workspace.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('workspace.description')}</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : data?.memberships.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.memberships.map((membership) => (
            <Card key={membership.clubId}>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
                  <Shield className="size-5" />
                </div>
                <CardTitle>{membership.clubName}</CardTitle>
                <CardDescription className="capitalize">{membership.role}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary">
                  <Link href={`/workspace/clubs/${membership.clubId}`}>
                    {t('clubs.open')}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
              <Users className="size-5" />
            </div>
            <CardTitle>{t('workspace.noClub')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/workspace/clubs">{t('clubs.new')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

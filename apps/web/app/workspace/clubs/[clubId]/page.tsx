'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClubDrawer } from '@/components/clubs/club-drawer';
import {
  ClubLifecycleActions,
  clubLifecycleVisibility,
} from '@/components/clubs/club-lifecycle-actions';
import { OwnershipRecoveryAction } from '@/components/clubs/ownership-recovery-action';
import { useWorkspaceClub, useWorkspaceMe } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

export default function ClubPage() {
  const clubId = useParams<{ clubId: string }>().clubId;
  const { data: club, isLoading } = useWorkspaceClub(clubId);
  const { data: me } = useWorkspaceMe();
  const { t } = useLocale();
  if (isLoading || !club)
    return <main className="p-6 text-sm text-muted-foreground">{t('common.loading')}</main>;
  const permissions = me?.memberships.find(
    (membership) => membership.clubId === clubId,
  )?.permissions;
  const canUpdate = permissions?.includes('club.update') ?? false;
  const canManageMembers = permissions?.includes('members.manage') ?? false;
  const { canArchive, canRestore } = clubLifecycleVisibility({
    ...club,
    platformAdmin: me?.platformAdmin === true,
  });
  const canRecoverOwnership = me?.platformAdmin === true && !club.archivedAt;
  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{club.name}</h2>
            <BadgeStatus archived={Boolean(club.archivedAt)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {club.timeZone ?? t('clubForm.timeZoneNotConfigured')} · /{club.slug}
          </p>
        </div>
        {(canUpdate || canArchive || canRestore || canRecoverOwnership) && (
          <div className="flex gap-2">
            {canUpdate && !club.archivedAt && (
              <ClubDrawer club={club}>
                <Button variant="outline">{t('common.edit')}</Button>
              </ClubDrawer>
            )}
            {canRecoverOwnership && <OwnershipRecoveryAction clubId={clubId} />}
            <ClubLifecycleActions
              clubId={clubId}
              archived={Boolean(club.archivedAt)}
              canArchive={canArchive}
              canRestore={canRestore}
            />
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
              <Users />
            </div>
            <CardTitle>
              {club.memberCount} {t('clubs.members').toLowerCase()}
            </CardTitle>
            <CardDescription>{t('members.description')}</CardDescription>
          </CardHeader>
          {canManageMembers && (
            <CardContent>
              <Button asChild variant="secondary">
                <Link href={`/workspace/clubs/${clubId}/members`}>
                  {t('sidebar.members')}
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </main>
  );
}

function BadgeStatus({ archived }: { archived: boolean }) {
  const { t } = useLocale();
  return (
    <span
      className={
        archived
          ? 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
          : 'rounded-full bg-brand-soft px-2 py-0.5 text-xs text-primary'
      }
    >
      {archived ? t('clubs.archived') : t('clubs.active')}
    </span>
  );
}

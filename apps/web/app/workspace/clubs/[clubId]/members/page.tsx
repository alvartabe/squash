'use client';

import { useParams } from 'next/navigation';
import { MembersPage } from '@/components/members/members-page';
import { useWorkspaceClub } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

export default function ClubMembersPage() {
  const clubId = useParams<{ clubId: string }>().clubId;
  const { data: club } = useWorkspaceClub(clubId);
  const { t } = useLocale();
  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('members.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {club?.name ?? t('common.loading')} · {t('members.description')}
        </p>
      </div>
      <MembersPage clubId={clubId} />
    </main>
  );
}

'use client';

import { useParams } from 'next/navigation';
import type { MessageKey } from '@squash/i18n';
import { ComingSoon } from '@/components/workspace/coming-soon';
import { SessionsPage } from '@/components/sessions/sessions-page';
import { useLocale } from '@/src/locale-provider';

const titles: Record<string, MessageKey> = {
  sessions: 'sidebar.sessions',
  tournaments: 'sidebar.tournaments',
  matches: 'sidebar.matches',
  statistics: 'sidebar.statistics',
};

export default function ClubFeaturePage() {
  const { clubId, feature } = useParams<{ clubId: string; feature: string }>();
  const { t } = useLocale();
  if (feature === 'sessions') return <SessionsPage clubId={clubId} />;
  return <ComingSoon title={t(titles[feature] ?? 'workspace.heading')} />;
}

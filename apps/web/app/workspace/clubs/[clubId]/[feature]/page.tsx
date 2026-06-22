'use client';

import { useParams } from 'next/navigation';
import type { MessageKey } from '@squash/i18n';
import { ComingSoon } from '@/components/workspace/coming-soon';
import { useLocale } from '@/src/locale-provider';

const titles: Record<string, MessageKey> = {
  availability: 'sidebar.availability',
  'open-play': 'sidebar.openPlay',
  challenges: 'sidebar.challenges',
  tournaments: 'sidebar.tournaments',
  matches: 'sidebar.matches',
  statistics: 'sidebar.statistics',
};

export default function ClubFeaturePage() {
  const { feature } = useParams<{ feature: string }>();
  const { t } = useLocale();
  return <ComingSoon title={t(titles[feature] ?? 'workspace.heading')} />;
}

'use client';

import { useParams } from 'next/navigation';
import type { MessageKey } from '@squash/i18n';
import { ComingSoon } from '@/components/workspace/coming-soon';
import { useLocale } from '@/src/locale-provider';

const titles: Record<string, MessageKey> = {
  users: 'sidebar.users',
  audit: 'sidebar.audit',
  media: 'sidebar.media',
  jobs: 'sidebar.jobs',
};
export default function PlatformFeaturePage() {
  const { feature } = useParams<{ feature: string }>();
  const { t } = useLocale();
  return <ComingSoon title={t(titles[feature] ?? 'sidebar.platform')} />;
}

'use client';

import { useParams } from 'next/navigation';
import { ComingSoon } from '@/components/workspace/coming-soon';
import { useLocale } from '@/src/locale-provider';
export default function AccountSectionPage() {
  const { section } = useParams<{ section: string }>();
  const { t } = useLocale();
  return (
    <ComingSoon
      title={t(section === 'equipment' ? 'userMenu.equipment' : 'userMenu.notifications')}
    />
  );
}

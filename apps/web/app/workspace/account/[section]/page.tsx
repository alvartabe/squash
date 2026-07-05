'use client';

import { ComingSoon } from '@/components/workspace/coming-soon';
import { useLocale } from '@/src/locale-provider';
export default function AccountSectionPage() {
  const { t } = useLocale();
  return <ComingSoon title={t('userMenu.notifications')} />;
}

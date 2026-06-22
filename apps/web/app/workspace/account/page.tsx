'use client';

import { ComingSoon } from '@/components/workspace/coming-soon';
import { useLocale } from '@/src/locale-provider';
export default function AccountPage() {
  const { t } = useLocale();
  return <ComingSoon title={t('userMenu.profile')} />;
}

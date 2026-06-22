'use client';

import { ClubsTable } from '@/components/clubs/clubs-table';
import { useLocale } from '@/src/locale-provider';

export default function ClubsPage() {
  const { t } = useLocale();
  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('clubs.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('clubs.description')}</p>
      </div>
      <ClubsTable />
    </main>
  );
}

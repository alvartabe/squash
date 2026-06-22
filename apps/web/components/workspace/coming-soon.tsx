'use client';

import { Construction } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/src/locale-provider';

export function ComingSoon({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <main className="px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
            <Construction />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{t('workspace.comingSoon')}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

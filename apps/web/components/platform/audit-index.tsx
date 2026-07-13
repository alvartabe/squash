'use client';

import { useMemo } from 'react';
import type { AuditRecord } from '@squash/contracts';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePlatformAuditRecords } from '@/src/hooks/audit';
import { useLocale } from '@/src/locale-provider';

function AuditRow({ record }: { record: AuditRecord }) {
  const { locale, t } = useLocale();
  const createdAt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(record.createdAt)),
    [locale, record.createdAt],
  );

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{createdAt}</TableCell>
      <TableCell className="font-mono text-xs">{record.action}</TableCell>
      <TableCell className="font-mono text-xs">
        {record.actorId ?? t('audit.notRecorded')}
      </TableCell>
      <TableCell className="font-mono text-xs">{record.entityType}</TableCell>
      <TableCell className="font-mono text-xs">{record.entityId}</TableCell>
      <TableCell className="font-mono text-xs">{record.clubId ?? t('audit.notRecorded')}</TableCell>
      <TableCell className="font-mono text-xs">{record.id}</TableCell>
    </TableRow>
  );
}

export function AuditIndex() {
  const { t } = useLocale();
  const query = usePlatformAuditRecords();
  const records = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('audit.heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('audit.description')}</p>
      </header>

      {query.isLoading ? (
        <p role="status">{t('common.loading')}</p>
      ) : query.isError ? (
        <div role="alert" className="space-y-3">
          <p>{t('audit.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : records.length === 0 ? (
        <p>{t('audit.empty')}</p>
      ) : (
        <div className="space-y-4">
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {records.length} {t('audit.recordsLoaded')}
          </p>
          <Table aria-label={t('audit.tableLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit.createdAt')}</TableHead>
                <TableHead>{t('audit.action')}</TableHead>
                <TableHead>{t('audit.actorId')}</TableHead>
                <TableHead>{t('audit.entityType')}</TableHead>
                <TableHead>{t('audit.entityId')}</TableHead>
                <TableHead>{t('audit.clubId')}</TableHead>
                <TableHead>{t('audit.recordId')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <AuditRow key={record.id} record={record} />
              ))}
            </TableBody>
          </Table>
          {query.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetchingNextPage}
              aria-label={t('audit.loadMore')}
              aria-live="polite"
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? t('audit.loadingMore') : t('audit.loadMore')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

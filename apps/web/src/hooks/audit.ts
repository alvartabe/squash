'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { AuditRecordPage } from '@squash/contracts';
import { api } from '@/src/lib/api';

export const platformAuditKey = ['workspace', 'platform', 'audit'] as const;

export function usePlatformAuditRecords() {
  return useInfiniteQuery({
    queryKey: platformAuditKey,
    queryFn: async ({ pageParam }): Promise<AuditRecordPage> =>
      (
        await api.get('/platform/audit', {
          params: pageParam ? { cursor: pageParam } : undefined,
        })
      ).data.data,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

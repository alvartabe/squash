'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@squash/api-client';
import type { MembershipRequest, PaginatedData } from '@squash/contracts';
import { membershipRequestApi } from '@/src/lib/api';
import {
  membershipRequestErrorCode,
  membershipRequestReviewMutationOptions,
} from './membership-request-review.mjs';

export { membershipRequestErrorCode };

export function usePendingMembershipRequests(
  clubId: string,
  input: { page: number; pageSize: number; search: string },
  enabled: boolean,
) {
  return useQuery<PaginatedData<MembershipRequest>>({
    queryKey: [
      ...queryKeys.membershipRequests(clubId),
      input.page,
      input.pageSize,
      input.search,
      'pending',
    ],
    enabled: enabled && Boolean(clubId),
    queryFn: async () =>
      (
        await membershipRequestApi.getMembershipRequests(clubId, {
          ...input,
          status: 'pending',
        })
      ).data,
  });
}

export function useApproveMembershipRequest(clubId: string) {
  const client = useQueryClient();
  return useMutation(
    membershipRequestReviewMutationOptions(
      clubId,
      'approve',
      client,
      membershipRequestApi,
      queryKeys,
    ),
  );
}

export function useRejectMembershipRequest(clubId: string) {
  const client = useQueryClient();
  return useMutation(
    membershipRequestReviewMutationOptions(
      clubId,
      'reject',
      client,
      membershipRequestApi,
      queryKeys,
    ),
  );
}

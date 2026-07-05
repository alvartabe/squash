import type { QueryClient } from '@tanstack/react-query';
import type { queryKeys, squashApi } from '@squash/api-client';

type ReviewDecision = 'approve' | 'reject';
type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;
type MembershipRequestApi = Pick<
  ReturnType<typeof squashApi>,
  'approveMembershipRequest' | 'rejectMembershipRequest'
>;
type MembershipRequestQueryKeys = Pick<typeof queryKeys, 'membershipRequests'>;

export function membershipRequestErrorCode(error: unknown): string | undefined;

export function membershipRequestInvalidationKeys(
  clubId: string,
  decision: ReviewDecision,
  queryKeys: MembershipRequestQueryKeys,
): ReadonlyArray<readonly unknown[]>;

export function membershipRequestReviewMutationOptions(
  clubId: string,
  decision: ReviewDecision,
  client: QueryInvalidator,
  requestApi: MembershipRequestApi,
  queryKeys: MembershipRequestQueryKeys,
): {
  mutationFn: (requestId: string) => Promise<unknown>;
  onSuccess: () => Promise<void>;
  onError: (error: unknown) => Promise<void> | undefined;
};

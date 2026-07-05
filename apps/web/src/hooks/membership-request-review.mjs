export function membershipRequestErrorCode(error) {
  return error?.response?.data?.error?.code;
}

export function membershipRequestInvalidationKeys(clubId, decision, queryKeys) {
  const queue = queryKeys.membershipRequests(clubId);
  if (decision === 'reject') return [queue];
  return [
    queue,
    ['workspace', 'club', clubId, 'members'],
    ['workspace', 'club', clubId],
    ['workspace', 'clubs'],
  ];
}

async function invalidateKeys(client, keys) {
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function membershipRequestReviewMutationOptions(
  clubId,
  decision,
  client,
  requestApi,
  queryKeys,
) {
  return {
    mutationFn: (requestId) =>
      decision === 'approve'
        ? requestApi.approveMembershipRequest(clubId, requestId)
        : requestApi.rejectMembershipRequest(clubId, requestId),
    onSuccess: () =>
      invalidateKeys(client, membershipRequestInvalidationKeys(clubId, decision, queryKeys)),
    onError: (error) => {
      if (membershipRequestErrorCode(error) === 'MEMBERSHIP_REQUEST_NOT_PENDING') {
        return invalidateKeys(client, [queryKeys.membershipRequests(clubId)]);
      }
      return undefined;
    },
  };
}

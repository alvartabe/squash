import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import {
  membershipRequestInvalidationKeys,
  membershipRequestReviewMutationOptions,
} from './membership-request-review.mjs';

const queryKeys = {
  membershipRequests: (clubId) => ['clubs', clubId, 'membership-requests'],
};
const requestApi = {
  getMembershipRequests: mock.fn(),
  approveMembershipRequest: mock.fn(),
  rejectMembershipRequest: mock.fn(),
};

function invalidator() {
  return { invalidateQueries: mock.fn(async () => undefined) };
}

describe('Membership Request review mutations', () => {
  beforeEach(() => {
    requestApi.getMembershipRequests.mock.resetCalls();
    requestApi.approveMembershipRequest.mock.resetCalls();
    requestApi.rejectMembershipRequest.mock.resetCalls();
  });

  it('approves through the API and refreshes the queue, members, Club, and counts', async () => {
    const client = invalidator();
    const options = membershipRequestReviewMutationOptions(
      'club-id',
      'approve',
      client,
      requestApi,
      queryKeys,
    );

    await options.mutationFn('request-id');
    await options.onSuccess();

    assert.deepEqual(requestApi.approveMembershipRequest.mock.calls[0].arguments, [
      'club-id',
      'request-id',
    ]);
    assert.equal(requestApi.rejectMembershipRequest.mock.callCount(), 0);
    assert.deepEqual(membershipRequestInvalidationKeys('club-id', 'approve', queryKeys), [
      ['clubs', 'club-id', 'membership-requests'],
      ['workspace', 'club', 'club-id', 'members'],
      ['workspace', 'club', 'club-id'],
      ['workspace', 'clubs'],
    ]);
    assert.equal(client.invalidateQueries.mock.callCount(), 4);
  });

  it('rejects through the API and refreshes only the Pending queue', async () => {
    const client = invalidator();
    const options = membershipRequestReviewMutationOptions(
      'club-id',
      'reject',
      client,
      requestApi,
      queryKeys,
    );

    await options.mutationFn('request-id');
    await options.onSuccess();

    assert.deepEqual(requestApi.rejectMembershipRequest.mock.calls[0].arguments, [
      'club-id',
      'request-id',
    ]);
    assert.equal(requestApi.approveMembershipRequest.mock.callCount(), 0);
    assert.deepEqual(membershipRequestInvalidationKeys('club-id', 'reject', queryKeys), [
      ['clubs', 'club-id', 'membership-requests'],
    ]);
    assert.equal(client.invalidateQueries.mock.callCount(), 1);
  });

  it('refreshes the Pending queue when a request is no longer Pending', async () => {
    const client = invalidator();
    const options = membershipRequestReviewMutationOptions(
      'club-id',
      'approve',
      client,
      requestApi,
      queryKeys,
    );

    await options.onError({
      response: { data: { error: { code: 'MEMBERSHIP_REQUEST_NOT_PENDING' } } },
    });

    assert.deepEqual(client.invalidateQueries.mock.calls[0].arguments, [
      { queryKey: ['clubs', 'club-id', 'membership-requests'] },
    ]);
  });
});

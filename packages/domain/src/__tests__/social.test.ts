import {
  canCancelChallenge,
  canDisputeChallenge,
  canRespondToFriendship,
  canSubmitInitialMatchResult,
  isAcceptedFriendship,
} from '../social';

const pendingFriendship = {
  requesterId: 'requester',
  addresseeId: 'addressee',
  status: 'pending' as const,
};

describe('friendship authorization', () => {
  it('allows only the addressee to accept or decline a pending request', () => {
    expect(canRespondToFriendship('addressee', pendingFriendship, 'accepted')).toBe(true);
    expect(canRespondToFriendship('addressee', pendingFriendship, 'declined')).toBe(true);
    expect(canRespondToFriendship('requester', pendingFriendship, 'accepted')).toBe(false);
    expect(canRespondToFriendship('requester', pendingFriendship, 'declined')).toBe(false);
  });

  it('allows either participant to block the other', () => {
    expect(canRespondToFriendship('requester', pendingFriendship, 'blocked')).toBe(true);
    expect(canRespondToFriendship('addressee', pendingFriendship, 'blocked')).toBe(true);
    expect(canRespondToFriendship('unrelated', pendingFriendship, 'blocked')).toBe(false);
  });

  it('recognizes accepted friendships in either direction', () => {
    const accepted = { ...pendingFriendship, status: 'accepted' as const };
    expect(isAcceptedFriendship(accepted, 'requester', 'addressee')).toBe(true);
    expect(isAcceptedFriendship(accepted, 'addressee', 'requester')).toBe(true);
    expect(isAcceptedFriendship(pendingFriendship, 'requester', 'addressee')).toBe(false);
  });
});

describe('match result authorization', () => {
  it('requires an accepted challenge for the initial result', () => {
    expect(canSubmitInitialMatchResult('scheduled', 'accepted')).toBe(true);
    expect(canSubmitInitialMatchResult('in-progress', 'accepted')).toBe(true);
    expect(canSubmitInitialMatchResult('scheduled', 'pending')).toBe(false);
    expect(canSubmitInitialMatchResult('void', 'accepted')).toBe(false);
  });
});

describe('challenge lifecycle authorization', () => {
  const pending = {
    creatorId: 'creator',
    opponentId: 'opponent',
    status: 'pending' as const,
  };

  it('lets only the creator cancel a pending challenge', () => {
    expect(canCancelChallenge('creator', pending)).toBe(true);
    expect(canCancelChallenge('opponent', pending)).toBe(false);
  });

  it('lets either participant cancel an accepted challenge', () => {
    const accepted = { ...pending, status: 'accepted' as const };
    expect(canCancelChallenge('creator', accepted)).toBe(true);
    expect(canCancelChallenge('opponent', accepted)).toBe(true);
    expect(canCancelChallenge('unrelated', accepted)).toBe(false);
  });

  it('only permits disputes for participants of a completed challenge and match', () => {
    const completed = { ...pending, status: 'completed' as const };
    expect(canDisputeChallenge('creator', completed, 'completed')).toBe(true);
    expect(canDisputeChallenge('opponent', completed, 'completed')).toBe(true);
    expect(canDisputeChallenge('unrelated', completed, 'completed')).toBe(false);
    expect(canDisputeChallenge('creator', completed, 'void')).toBe(false);
  });
});

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type FriendResponse = 'accepted' | 'declined' | 'blocked';
export type MatchStatus = 'scheduled' | 'in-progress' | 'completed' | 'disputed' | 'void';
export type ChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'disputed';

type Friendship = {
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
};

type Challenge = {
  creatorId: string;
  opponentId: string;
  status: ChallengeStatus;
};

export function isAcceptedFriendship(
  friendship: Friendship | null,
  playerOneId: string,
  playerTwoId: string,
): boolean {
  if (!friendship || friendship.status !== 'accepted') return false;
  return (
    (friendship.requesterId === playerOneId && friendship.addresseeId === playerTwoId) ||
    (friendship.requesterId === playerTwoId && friendship.addresseeId === playerOneId)
  );
}

export function canRespondToFriendship(
  actorId: string,
  friendship: Friendship,
  response: FriendResponse,
): boolean {
  if (response === 'blocked') {
    return actorId === friendship.requesterId || actorId === friendship.addresseeId;
  }
  return friendship.status === 'pending' && actorId === friendship.addresseeId;
}

export function canSubmitInitialMatchResult(
  matchStatus: MatchStatus,
  challengeStatus?: ChallengeStatus,
): boolean {
  if (matchStatus !== 'scheduled' && matchStatus !== 'in-progress') return false;
  return challengeStatus === undefined || challengeStatus === 'accepted';
}

export function canCancelChallenge(actorId: string, challenge: Challenge): boolean {
  if (challenge.status === 'pending') return actorId === challenge.creatorId;
  if (challenge.status !== 'accepted') return false;
  return actorId === challenge.creatorId || actorId === challenge.opponentId;
}

export function canDisputeChallenge(
  actorId: string,
  challenge: Challenge,
  matchStatus: MatchStatus,
): boolean {
  if (challenge.status !== 'completed' || matchStatus !== 'completed') return false;
  return actorId === challenge.creatorId || actorId === challenge.opponentId;
}

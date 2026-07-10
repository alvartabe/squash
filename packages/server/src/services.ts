import type {
  CreateChallengeInput,
  CreateClubInput,
  PlayerStatistics,
  SetScoreInput,
} from '@squash/contracts';
import {
  challengeStats,
  challenges,
  clubMemberships,
  clubResponsibilities,
  clubs,
  auditLogs,
  deviceTokens,
  friendships,
  matchParticipants,
  matchResultRevisions,
  matchRuleSnapshots,
  matches,
  matchSets,
  outboxEvents,
  playerProfiles,
  playerRackets,
  recurringAvailability,
  notifications,
  tournamentFixtures,
  tournamentStats,
  users,
} from '@squash/db/schema';
import {
  canCancelChallenge,
  canDisputeChallenge,
  canRespondToFriendship,
  canSubmitInitialMatchResult,
  calculateMatchResult,
  isAcceptedFriendship,
} from '@squash/domain';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from './database';
import { forbidden, notFound, ServiceError } from './errors';
import {
  requireActiveClubMembership,
  requireClubAction,
  requirePlatformAdmin,
} from './authorization';
import { membershipResponsibilities } from './membership';
import { clubProfileValues } from './club-profile';
import { requireOwnedClubLogoAsset } from './media';

function ruleRecord(rules: { bestOf: number; pointsToWin: number; winByTwo: boolean }) {
  return { bestOf: rules.bestOf, pointsToWin: rules.pointsToWin, winByTwo: rules.winByTwo };
}

export async function createClub(actorId: string, input: CreateClubInput) {
  await requirePlatformAdmin(actorId);
  const { initialOwnerId, slug } = input;
  if (input.logoAssetId) {
    await requireOwnedClubLogoAsset(actorId, input.logoAssetId);
  }
  const clubInput = { ...clubProfileValues(input), slug };

  return db.transaction(async (tx) => {
    const [initialOwner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, initialOwnerId))
      .limit(1);
    if (!initialOwner) throw notFound('INITIAL_CLUB_OWNER_NOT_FOUND');

    const [club] = await tx.insert(clubs).values(clubInput).returning();
    if (!club) throw new Error('Failed to create club.');
    await tx.insert(clubMemberships).values({ clubId: club.id, userId: initialOwnerId });
    await tx
      .insert(clubResponsibilities)
      .values({ clubId: club.id, userId: initialOwnerId, responsibility: 'owner' });
    await tx.insert(auditLogs).values({
      actorId,
      clubId: club.id,
      action: 'club.create',
      entityType: 'club',
      entityId: club.id,
      metadata: {
        ...clubInput,
        initialOwnerId,
      },
    });
    return club;
  });
}

export async function listMyClubs(actorId: string) {
  const memberships = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      timeZone: clubs.timeZone,
      membershipStatus: clubMemberships.status,
      responsibilities: membershipResponsibilities,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(
      and(
        eq(clubMemberships.userId, actorId),
        eq(clubMemberships.status, 'active'),
        isNull(clubs.archivedAt),
      ),
    )
    .orderBy(asc(clubs.name));
  return memberships;
}

export async function updateProfile(
  actorId: string,
  input: {
    name: string;
    bio?: string | null | undefined;
    dominantHand?: 'left' | 'right' | 'ambidextrous' | null | undefined;
    visibility: 'private' | 'friends' | 'shared-clubs';
    locale: 'en-US' | 'es-419';
    timeZone: string;
  },
) {
  return db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        name: input.name,
        locale: input.locale,
        timeZone: input.timeZone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actorId));
    const [profile] = await tx
      .insert(playerProfiles)
      .values({
        userId: actorId,
        bio: input.bio ?? null,
        dominantHand: input.dominantHand ?? null,
        visibility: input.visibility,
      })
      .onConflictDoUpdate({
        target: playerProfiles.userId,
        set: {
          bio: input.bio ?? null,
          dominantHand: input.dominantHand ?? null,
          visibility: input.visibility,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  });
}

export async function requestFriend(actorId: string, addresseeId: string) {
  if (actorId === addresseeId)
    throw new ServiceError('SELF_FRIEND_REQUEST', 'error.invalidRequest', 400);
  const existing = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, actorId), eq(friendships.addresseeId, addresseeId)),
        and(eq(friendships.requesterId, addresseeId), eq(friendships.addresseeId, actorId)),
      ),
    )
    .limit(1);
  if (existing.length > 0) throw new ServiceError('FRIENDSHIP_EXISTS', 'error.invalidRequest', 409);
  const [friendship] = await db
    .insert(friendships)
    .values({ requesterId: actorId, addresseeId })
    .returning();
  if (!friendship) throw new Error('Failed to create friendship.');
  await db.insert(outboxEvents).values({
    topic: 'friend.requested',
    aggregateId: friendship.id,
    payload: { recipientId: addresseeId, friendshipId: friendship.id },
  });
  return friendship;
}

export function listFriends(actorId: string) {
  return db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, actorId), eq(friendships.addresseeId, actorId)))
    .orderBy(desc(friendships.updatedAt));
}

export async function respondToFriend(
  actorId: string,
  friendshipId: string,
  status: 'accepted' | 'declined' | 'blocked',
) {
  const [current] = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
    })
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!current) throw notFound('FRIENDSHIP_NOT_FOUND');
  if (!canRespondToFriendship(actorId, current, status)) throw forbidden();

  const [friendship] = await db
    .update(friendships)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(friendships.id, friendshipId), eq(friendships.status, current.status)))
    .returning();
  if (!friendship) throw new ServiceError('FRIENDSHIP_STATE_CONFLICT', 'error.invalidRequest', 409);
  return friendship;
}

export async function createRacket(
  actorId: string,
  input: {
    brand: string;
    model: string;
    weightGrams?: number | undefined;
    balance?: 'head-light' | 'even' | 'head-heavy' | undefined;
    stringType?: string | undefined;
    stringTension?: number | undefined;
    notes?: string | undefined;
  },
) {
  const [racket] = await db
    .insert(playerRackets)
    .values({ userId: actorId, ...input })
    .returning();
  return racket;
}

export function listRackets(actorId: string) {
  return db
    .select()
    .from(playerRackets)
    .where(eq(playerRackets.userId, actorId))
    .orderBy(desc(playerRackets.createdAt));
}

export async function replaceAvailability(
  actorId: string,
  windows: Array<{
    clubId?: string | undefined;
    weekday: number;
    startMinute: number;
    endMinute: number;
    timeZone: string;
  }>,
) {
  return db.transaction(async (tx) => {
    await tx.delete(recurringAvailability).where(eq(recurringAvailability.userId, actorId));
    if (windows.length === 0) return [];
    return tx
      .insert(recurringAvailability)
      .values(windows.map((window) => ({ userId: actorId, ...window })))
      .returning();
  });
}

export function getAvailability(actorId: string) {
  return db
    .select()
    .from(recurringAvailability)
    .where(eq(recurringAvailability.userId, actorId))
    .orderBy(asc(recurringAvailability.weekday), asc(recurringAvailability.startMinute));
}

export async function registerDeviceToken(
  actorId: string,
  input: { expoPushToken: string; platform: 'ios' | 'android' },
) {
  const [token] = await db
    .insert(deviceTokens)
    .values({ userId: actorId, ...input })
    .onConflictDoUpdate({
      target: deviceTokens.expoPushToken,
      set: { userId: actorId, platform: input.platform, active: true, updatedAt: new Date() },
    })
    .returning();
  return token;
}

export function listNotifications(actorId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, actorId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function createChallenge(actorId: string, input: CreateChallengeInput) {
  if (actorId === input.opponentId)
    throw new ServiceError('SELF_CHALLENGE', 'error.invalidRequest', 400);
  const [friendship] = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
    })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, actorId), eq(friendships.addresseeId, input.opponentId)),
        and(eq(friendships.requesterId, input.opponentId), eq(friendships.addresseeId, actorId)),
      ),
    )
    .limit(1);
  if (!isAcceptedFriendship(friendship ?? null, actorId, input.opponentId)) {
    throw new ServiceError('ACCEPTED_FRIENDSHIP_REQUIRED', 'error.forbidden', 403);
  }
  if (input.clubId) await requireActiveClubMembership(actorId, input.clubId);

  return db.transaction(async (tx) => {
    const [rules] = await tx.insert(matchRuleSnapshots).values(ruleRecord(input.rules)).returning();
    if (!rules) throw new Error('Failed to create rules.');
    const [match] = await tx
      .insert(matches)
      .values({
        clubId: input.clubId ?? null,
        source: 'challenge',
        countsForStatistics: true,
        status: 'scheduled',
        rulesId: rules.id,
        scheduledAt: new Date(input.scheduledAt),
      })
      .returning();
    if (!match) throw new Error('Failed to create match.');
    await tx.insert(matchParticipants).values([
      { matchId: match.id, userId: actorId, position: 1 },
      { matchId: match.id, userId: input.opponentId, position: 2 },
    ]);
    const [challenge] = await tx
      .insert(challenges)
      .values({
        clubId: input.clubId ?? null,
        matchId: match.id,
        creatorId: actorId,
        opponentId: input.opponentId,
        timeZone: input.timeZone,
      })
      .returning();
    if (!challenge) throw new Error('Failed to create challenge.');
    await tx.insert(outboxEvents).values({
      topic: 'challenge.invited',
      aggregateId: challenge.id,
      payload: { challengeId: challenge.id, recipientId: input.opponentId },
    });
    return challenge;
  });
}

export async function respondToChallenge(actorId: string, challengeId: string, accept: boolean) {
  return db.transaction(async (tx) => {
    const [challenge] = await tx
      .update(challenges)
      .set({ status: accept ? 'accepted' : 'declined', updatedAt: new Date() })
      .where(
        and(
          eq(challenges.id, challengeId),
          eq(challenges.opponentId, actorId),
          eq(challenges.status, 'pending'),
        ),
      )
      .returning();
    if (!challenge) throw new ServiceError('CHALLENGE_NOT_PENDING', 'error.invalidRequest', 409);
    if (!accept) {
      await tx
        .update(matches)
        .set({ status: 'void', updatedAt: new Date() })
        .where(eq(matches.id, challenge.matchId));
    }
    await tx.insert(outboxEvents).values({
      topic: accept ? 'challenge.accepted' : 'challenge.declined',
      aggregateId: challenge.id,
      payload: { challengeId: challenge.id, recipientId: challenge.creatorId },
    });
    return challenge;
  });
}

export async function cancelChallenge(actorId: string, challengeId: string, reason?: string) {
  const [current] = await db
    .select({
      id: challenges.id,
      clubId: challenges.clubId,
      matchId: challenges.matchId,
      creatorId: challenges.creatorId,
      opponentId: challenges.opponentId,
      status: challenges.status,
      matchStatus: matches.status,
    })
    .from(challenges)
    .innerJoin(matches, eq(matches.id, challenges.matchId))
    .where(eq(challenges.id, challengeId))
    .limit(1);
  if (!current) throw notFound('CHALLENGE_NOT_FOUND');
  if (!canCancelChallenge(actorId, current)) throw forbidden();

  return db.transaction(async (tx) => {
    const cancelledAt = new Date();
    const [challenge] = await tx
      .update(challenges)
      .set({ status: 'cancelled', updatedAt: cancelledAt })
      .where(and(eq(challenges.id, challengeId), eq(challenges.status, current.status)))
      .returning();
    if (!challenge) {
      throw new ServiceError('CHALLENGE_STATE_CONFLICT', 'error.invalidRequest', 409);
    }
    const [match] = await tx
      .update(matches)
      .set({ status: 'void', updatedAt: cancelledAt })
      .where(
        and(
          eq(matches.id, current.matchId),
          or(eq(matches.status, 'scheduled'), eq(matches.status, 'in-progress')),
        ),
      )
      .returning({ id: matches.id });
    if (!match) {
      throw new ServiceError('MATCH_STATE_CONFLICT', 'error.invalidRequest', 409);
    }
    await tx.insert(auditLogs).values({
      actorId,
      clubId: current.clubId,
      action: 'challenge.cancel',
      entityType: 'challenge',
      entityId: challengeId,
      metadata: { from: current.status, reason: reason?.trim() || null },
    });
    await tx.insert(outboxEvents).values({
      topic: 'challenge.cancelled',
      aggregateId: challengeId,
      payload: {
        challengeId,
        recipientId: actorId === current.creatorId ? current.opponentId : current.creatorId,
      },
    });
    return challenge;
  });
}

export async function disputeChallenge(actorId: string, challengeId: string, reason: string) {
  const [current] = await db
    .select({
      id: challenges.id,
      clubId: challenges.clubId,
      matchId: challenges.matchId,
      creatorId: challenges.creatorId,
      opponentId: challenges.opponentId,
      status: challenges.status,
      matchStatus: matches.status,
    })
    .from(challenges)
    .innerJoin(matches, eq(matches.id, challenges.matchId))
    .where(eq(challenges.id, challengeId))
    .limit(1);
  if (!current) throw notFound('CHALLENGE_NOT_FOUND');
  if (!canDisputeChallenge(actorId, current, current.matchStatus)) throw forbidden();

  return db.transaction(async (tx) => {
    const disputedAt = new Date();
    const [challenge] = await tx
      .update(challenges)
      .set({ status: 'disputed', updatedAt: disputedAt })
      .where(and(eq(challenges.id, challengeId), eq(challenges.status, 'completed')))
      .returning();
    if (!challenge) {
      throw new ServiceError('CHALLENGE_STATE_CONFLICT', 'error.invalidRequest', 409);
    }
    const [match] = await tx
      .update(matches)
      .set({ status: 'disputed', updatedAt: disputedAt })
      .where(and(eq(matches.id, current.matchId), eq(matches.status, 'completed')))
      .returning({ id: matches.id });
    if (!match) {
      throw new ServiceError('MATCH_STATE_CONFLICT', 'error.invalidRequest', 409);
    }
    await tx.insert(auditLogs).values({
      actorId,
      clubId: current.clubId,
      action: 'challenge.dispute',
      entityType: 'challenge',
      entityId: challengeId,
      metadata: { reason: reason.trim() },
    });
    await tx.insert(outboxEvents).values([
      {
        topic: 'challenge.disputed',
        aggregateId: challengeId,
        payload: {
          challengeId,
          recipientId: actorId === current.creatorId ? current.opponentId : current.creatorId,
        },
      },
      {
        topic: 'statistics.rebuild',
        aggregateId: current.matchId,
        payload: { matchId: current.matchId, source: 'challenge' },
      },
    ]);
    return challenge;
  });
}

export async function submitMatchResult(
  actorId: string,
  matchId: string,
  scores: readonly SetScoreInput[],
  reason?: string,
) {
  const [record] = await db
    .select({
      id: matches.id,
      clubId: matches.clubId,
      source: matches.source,
      status: matches.status,
      countsForStatistics: matches.countsForStatistics,
      revision: matches.currentRevision,
      bestOf: matchRuleSnapshots.bestOf,
      pointsToWin: matchRuleSnapshots.pointsToWin,
      winByTwo: matchRuleSnapshots.winByTwo,
    })
    .from(matches)
    .innerJoin(matchRuleSnapshots, eq(matchRuleSnapshots.id, matches.rulesId))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!record) throw notFound('MATCH_NOT_FOUND');
  if (record.source === 'tournament') throw forbidden();

  const participants = await db
    .select({ userId: matchParticipants.userId, position: matchParticipants.position })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(matchParticipants.position);
  if (participants.length !== 2)
    throw new ServiceError('INVALID_PARTICIPANTS', 'error.invalidRequest', 409);

  if (record.revision === 0) {
    if (!participants.some((participant) => participant.userId === actorId)) throw forbidden();
    let challengeStatus:
      | 'pending'
      | 'accepted'
      | 'declined'
      | 'cancelled'
      | 'completed'
      | 'disputed'
      | undefined;
    if (record.source === 'challenge') {
      const [challenge] = await db
        .select({ status: challenges.status })
        .from(challenges)
        .where(eq(challenges.matchId, matchId))
        .limit(1);
      if (!challenge) throw notFound('CHALLENGE_NOT_FOUND');
      challengeStatus = challenge.status;
    }
    if (!canSubmitInitialMatchResult(record.status, challengeStatus)) {
      throw new ServiceError('MATCH_NOT_READY_FOR_RESULT', 'error.invalidRequest', 409);
    }
  } else {
    if (record.status !== 'completed' && record.status !== 'disputed') {
      throw new ServiceError('MATCH_NOT_CORRECTABLE', 'error.invalidRequest', 409);
    }
    if (!reason?.trim()) {
      throw new ServiceError('REVISION_REASON_REQUIRED', 'error.invalidRequest', 400);
    }
    if (record.clubId) {
      await requireClubAction(actorId, record.clubId, 'results.correct');
    } else {
      await requirePlatformAdmin(actorId);
    }
  }

  const result = calculateMatchResult(scores, {
    bestOf: record.bestOf as 1 | 3 | 5,
    pointsToWin: record.pointsToWin,
    winByTwo: record.winByTwo,
  });
  if (!result.completed) throw new ServiceError('INCOMPLETE_MATCH', 'error.invalidRequest', 400);
  const winnerId = participants[result.winner === 1 ? 0 : 1]?.userId;
  if (!winnerId) throw new Error('Winner is missing.');

  await db.transaction(async (tx) => {
    const revision = record.revision + 1;
    const [updated] = await tx
      .update(matches)
      .set({
        status: 'completed',
        completedAt: new Date(),
        submittedById: actorId,
        winnerId,
        currentRevision: revision,
        updatedAt: new Date(),
      })
      .where(and(eq(matches.id, matchId), eq(matches.currentRevision, record.revision)))
      .returning({ id: matches.id });
    if (!updated) throw new ServiceError('RESULT_CONFLICT', 'error.invalidRequest', 409);
    await tx.delete(matchSets).where(eq(matchSets.matchId, matchId));
    await tx
      .insert(matchSets)
      .values(scores.map((score, index) => ({ matchId, setNumber: index + 1, ...score })));
    await tx.insert(matchResultRevisions).values({
      matchId,
      revision,
      submittedById: actorId,
      reason,
      result: { scores, ...result },
    });
    if (record.source === 'challenge') {
      await tx
        .update(challenges)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(challenges.matchId, matchId));
    }
    if (record.countsForStatistics) {
      await tx.insert(outboxEvents).values({
        topic: 'statistics.rebuild',
        aggregateId: matchId,
        payload: { matchId, source: record.source },
      });
    }
    if (record.source === 'tournament') {
      const [fixture] = await tx
        .select({ tournamentId: tournamentFixtures.tournamentId })
        .from(tournamentFixtures)
        .where(eq(tournamentFixtures.matchId, matchId))
        .limit(1);
      if (fixture) {
        await tx.insert(outboxEvents).values({
          topic: 'tournament.progress',
          aggregateId: matchId,
          payload: { matchId, tournamentId: fixture.tournamentId },
        });
      }
    }
  });
  return { matchId, winnerId, revision: record.revision + 1, result };
}

const emptyStats = () => ({
  matches: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  setsWon: 0,
  setsLost: 0,
  pointsFor: 0,
  pointsAgainst: 0,
});

export async function getPlayerStatistics(playerId: string): Promise<PlayerStatistics> {
  const [challenge] = await db
    .select()
    .from(challengeStats)
    .where(eq(challengeStats.userId, playerId))
    .limit(1);
  const [tournament] = await db
    .select()
    .from(tournamentStats)
    .where(eq(tournamentStats.userId, playerId))
    .limit(1);
  const toDto = (row: typeof challenge) =>
    row ? { ...row, winRate: row.matches === 0 ? 0 : row.wins / row.matches } : emptyStats();
  return { challenge: toDto(challenge), tournament: toDto(tournament) };
}

export async function healthCheck() {
  const result = await db.execute(sql`select 1 as ok`);
  return { ok: result.rowCount === 1, database: 'up' as const };
}

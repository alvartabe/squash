import type {
  CreateChallengeInput,
  CreateClubInput,
  CreateOpenPlaySessionInput,
  CreateTournamentInput,
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
  openPlayAttendees,
  openPlaySessions,
  outboxEvents,
  playerProfiles,
  playerRackets,
  recurringAvailability,
  notifications,
  tournamentAdvancements,
  tournamentFixtures,
  tournamentGroupMembers,
  tournamentGroups,
  tournamentRegistrations,
  tournamentStats,
  tournaments,
  users,
} from '@squash/db/schema';
import {
  assignPlayersToGroups,
  canCancelChallenge,
  canDisputeChallenge,
  canRespondToFriendship,
  canSubmitInitialMatchResult,
  calculateMatchResult,
  calculateStandings,
  createFirstRound,
  createRoundRobinPairs,
  isAcceptedFriendship,
  nextPowerOfTwo,
  qualifierOrder,
  type GroupMatch,
  type Qualifier,
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

function ruleRecord(rules: { bestOf: number; pointsToWin: number; winByTwo: boolean }) {
  return { bestOf: rules.bestOf, pointsToWin: rules.pointsToWin, winByTwo: rules.winByTwo };
}

export async function createClub(actorId: string, input: CreateClubInput) {
  await requirePlatformAdmin(actorId);
  const { initialOwnerId, ...clubInput } = input;

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
        name: club.name,
        slug: club.slug,
        timeZone: club.timeZone,
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

export async function createOpenPlay(actorId: string, input: CreateOpenPlaySessionInput) {
  await requireClubAction(actorId, input.clubId, 'session.create');
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (end <= start) throw new ServiceError('INVALID_TIME_RANGE', 'error.invalidRequest', 400);

  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(openPlaySessions)
      .values({
        clubId: input.clubId,
        organizerId: actorId,
        title: input.title,
        notes: input.notes,
        startsAt: start,
        endsAt: end,
        timeZone: input.timeZone,
      })
      .returning();
    if (!session) throw new Error('Failed to create open play.');
    await tx
      .insert(openPlayAttendees)
      .values({ sessionId: session.id, userId: actorId, status: 'accepted' });
    return session;
  });
}

export async function setOpenPlayAttendance(
  actorId: string,
  sessionId: string,
  status: 'accepted' | 'declined' | 'withdrawn',
) {
  const [session] = await db
    .select({ clubId: openPlaySessions.clubId })
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, sessionId))
    .limit(1);
  if (!session) throw notFound('SESSION_NOT_FOUND');
  await requireClubAction(actorId, session.clubId, 'session.create');
  const [attendance] = await db
    .insert(openPlayAttendees)
    .values({ sessionId, userId: actorId, status })
    .onConflictDoUpdate({
      target: [openPlayAttendees.sessionId, openPlayAttendees.userId],
      set: { status, updatedAt: new Date() },
    })
    .returning();
  return attendance;
}

export async function createTournament(actorId: string, input: CreateTournamentInput) {
  await requireClubAction(actorId, input.clubId, 'tournament.manage');
  return db.transaction(async (tx) => {
    const [rules] = await tx.insert(matchRuleSnapshots).values(ruleRecord(input.rules)).returning();
    if (!rules) throw new Error('Failed to create rules.');
    const [tournament] = await tx
      .insert(tournaments)
      .values({
        clubId: input.clubId,
        organizerId: actorId,
        name: input.name,
        startsAt: new Date(input.startsAt),
        registrationClosesAt: new Date(input.registrationClosesAt),
        timeZone: input.timeZone,
        groupSize: input.groupSize,
        qualifiersPerGroup: input.qualifiersPerGroup,
        seedingMethod: input.seedingMethod,
        rulesId: rules.id,
      })
      .returning();
    if (!tournament) throw new Error('Failed to create tournament.');
    return tournament;
  });
}

export async function registerForTournament(actorId: string, tournamentId: string) {
  const [tournament] = await db
    .select({
      clubId: tournaments.clubId,
      status: tournaments.status,
      closesAt: tournaments.registrationClosesAt,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw notFound('TOURNAMENT_NOT_FOUND');
  await requireActiveClubMembership(actorId, tournament.clubId);
  if (!['draft', 'registration'].includes(tournament.status) || tournament.closesAt < new Date()) {
    throw new ServiceError('REGISTRATION_CLOSED', 'error.invalidRequest', 409);
  }
  const [registration] = await db
    .insert(tournamentRegistrations)
    .values({ tournamentId, userId: actorId })
    .onConflictDoNothing()
    .returning();
  return registration ?? { tournamentId, userId: actorId };
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    const swap = random % (index + 1);
    [result[index], result[swap]] = [result[swap] as T, result[index] as T];
  }
  return result;
}

export async function generateTournamentGroups(actorId: string, tournamentId: string) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw notFound('TOURNAMENT_NOT_FOUND');
  await requireClubAction(actorId, tournament.clubId, 'tournament.manage');
  if (!['draft', 'registration'].includes(tournament.status)) {
    throw new ServiceError('TOURNAMENT_ALREADY_STARTED', 'error.invalidRequest', 409);
  }
  const registrations = await db
    .select({ userId: tournamentRegistrations.userId, seed: tournamentRegistrations.seed })
    .from(tournamentRegistrations)
    .where(eq(tournamentRegistrations.tournamentId, tournamentId))
    .orderBy(asc(tournamentRegistrations.seed), asc(tournamentRegistrations.registeredAt));
  const ordered = tournament.seedingMethod === 'random' ? shuffled(registrations) : registrations;
  const assignments = assignPlayersToGroups(
    ordered.map((item) => item.userId),
    tournament.groupSize,
  );

  await db.transaction(async (tx) => {
    for (const assignment of assignments) {
      const [group] = await tx
        .insert(tournamentGroups)
        .values({
          tournamentId,
          name: String.fromCharCode(64 + assignment.groupPosition),
          position: assignment.groupPosition,
        })
        .returning();
      if (!group) throw new Error('Failed to create tournament group.');
      await tx.insert(tournamentGroupMembers).values(
        assignment.playerIds.map((userId) => ({
          groupId: group.id,
          userId,
          seed: registrations.find((item) => item.userId === userId)?.seed,
        })),
      );
      for (const [position, pair] of createRoundRobinPairs(assignment.playerIds).entries()) {
        const [match] = await tx
          .insert(matches)
          .values({
            clubId: tournament.clubId,
            source: 'tournament',
            countsForStatistics: true,
            status: 'scheduled',
            rulesId: tournament.rulesId,
          })
          .returning();
        if (!match) throw new Error('Failed to create group match.');
        await tx.insert(matchParticipants).values([
          { matchId: match.id, userId: pair.playerOneId, position: 1 },
          { matchId: match.id, userId: pair.playerTwoId, position: 2 },
        ]);
        await tx.insert(tournamentFixtures).values({
          tournamentId,
          groupId: group.id,
          matchId: match.id,
          stage: 'group',
          round: pair.round,
          position: position + 1,
          playerOneId: pair.playerOneId,
          playerTwoId: pair.playerTwoId,
        });
      }
    }
    await tx
      .update(tournaments)
      .set({ status: 'group-stage', updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
  });
  return { tournamentId, groups: assignments.length, players: registrations.length };
}

async function groupQualifiers(
  tournamentId: string,
  qualifiersPerGroup: number,
): Promise<Qualifier[]> {
  const groups = await db
    .select()
    .from(tournamentGroups)
    .where(eq(tournamentGroups.tournamentId, tournamentId));
  const qualifiers: Qualifier[] = [];
  for (const group of groups) {
    const members = await db
      .select({ userId: tournamentGroupMembers.userId })
      .from(tournamentGroupMembers)
      .where(eq(tournamentGroupMembers.groupId, group.id));
    const fixtures = await db
      .select({
        matchId: tournamentFixtures.matchId,
        playerOneId: tournamentFixtures.playerOneId,
        playerTwoId: tournamentFixtures.playerTwoId,
        status: matches.status,
      })
      .from(tournamentFixtures)
      .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
      .where(and(eq(tournamentFixtures.groupId, group.id), eq(tournamentFixtures.stage, 'group')));
    if (fixtures.some((fixture) => fixture.status !== 'completed')) return [];
    const groupMatches: GroupMatch[] = [];
    for (const fixture of fixtures) {
      if (!fixture.matchId || !fixture.playerOneId || !fixture.playerTwoId) continue;
      const sets = await db.select().from(matchSets).where(eq(matchSets.matchId, fixture.matchId));
      groupMatches.push({
        playerOneId: fixture.playerOneId,
        playerTwoId: fixture.playerTwoId,
        playerOneSets: sets.filter((set) => set.playerOnePoints > set.playerTwoPoints).length,
        playerTwoSets: sets.filter((set) => set.playerTwoPoints > set.playerOnePoints).length,
        playerOnePoints: sets.reduce((total, set) => total + set.playerOnePoints, 0),
        playerTwoPoints: sets.reduce((total, set) => total + set.playerTwoPoints, 0),
      });
    }
    const standings = calculateStandings(
      members.map((member) => member.userId),
      groupMatches,
    );
    await db.transaction(async (tx) => {
      for (const standing of standings) {
        await tx
          .update(tournamentGroupMembers)
          .set({ finalRank: standing.rank })
          .where(
            and(
              eq(tournamentGroupMembers.groupId, group.id),
              eq(tournamentGroupMembers.userId, standing.playerId),
            ),
          );
      }
    });
    qualifiers.push(
      ...standings.slice(0, qualifiersPerGroup).map((standing) => ({
        playerId: standing.playerId,
        groupId: group.id,
        groupRank: standing.rank,
        wins: standing.wins,
        setDifferential: standing.setDifferential,
        pointDifferential: standing.pointDifferential,
      })),
    );
  }
  return qualifiers;
}

export async function progressTournament(tournamentId: string) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament || tournament.status !== 'group-stage') return { progressed: false };
  const qualifiers = await groupQualifiers(tournamentId, tournament.qualifiersPerGroup);
  if (qualifiers.length === 0) return { progressed: false };
  const seeded = [...qualifiers].sort(qualifierOrder);
  const firstRound = createFirstRound(seeded);
  const bracketSize = nextPowerOfTwo(seeded.length);
  const totalRounds = Math.log2(bracketSize);

  await db.transaction(async (tx) => {
    await tx.insert(tournamentAdvancements).values(
      seeded.map((qualifier, index) => ({
        tournamentId,
        userId: qualifier.playerId,
        groupId: qualifier.groupId,
        groupRank: qualifier.groupRank,
        bracketSeed: index + 1,
      })),
    );
    const rounds = new Map<number, Array<{ id: string; position: number }>>();
    for (let round = totalRounds; round >= 1; round -= 1) {
      const fixtureCount = bracketSize / 2 ** round;
      const inserted = await tx
        .insert(tournamentFixtures)
        .values(
          Array.from({ length: fixtureCount }, (_, index) => {
            const opening = round === 1 ? firstRound[index] : undefined;
            return {
              tournamentId,
              stage: 'knockout' as const,
              round,
              position: index + 1,
              playerOneId: opening?.playerOneId,
              playerTwoId: opening?.playerTwoId,
            };
          }),
        )
        .returning({ id: tournamentFixtures.id, position: tournamentFixtures.position });
      rounds.set(round, inserted);
    }
    for (let round = 1; round < totalRounds; round += 1) {
      for (const fixture of rounds.get(round) ?? []) {
        const target = rounds
          .get(round + 1)
          ?.find((item) => item.position === Math.ceil(fixture.position / 2));
        if (target) {
          await tx
            .update(tournamentFixtures)
            .set({
              advancesToFixtureId: target.id,
              advancesToPosition: fixture.position % 2 === 1 ? 1 : 2,
            })
            .where(eq(tournamentFixtures.id, fixture.id));
        }
      }
    }
    for (const fixture of rounds.get(1) ?? []) {
      const opening = firstRound.find((item) => item.position === fixture.position);
      if (!opening) continue;
      if (opening.playerOneId && opening.playerTwoId) {
        const [match] = await tx
          .insert(matches)
          .values({
            clubId: tournament.clubId,
            source: 'tournament',
            countsForStatistics: true,
            status: 'scheduled',
            rulesId: tournament.rulesId,
          })
          .returning();
        if (!match) throw new Error('Failed to create knockout match.');
        await tx.insert(matchParticipants).values([
          { matchId: match.id, userId: opening.playerOneId, position: 1 },
          { matchId: match.id, userId: opening.playerTwoId, position: 2 },
        ]);
        await tx
          .update(tournamentFixtures)
          .set({ matchId: match.id })
          .where(eq(tournamentFixtures.id, fixture.id));
      } else if (opening.byePlayerId && totalRounds > 1) {
        const target = rounds
          .get(2)
          ?.find((item) => item.position === Math.ceil(fixture.position / 2));
        if (target) {
          await tx
            .update(tournamentFixtures)
            .set(
              fixture.position % 2 === 1
                ? { playerOneId: opening.byePlayerId }
                : { playerTwoId: opening.byePlayerId },
            )
            .where(eq(tournamentFixtures.id, target.id));
        }
      }
    }
    await tx
      .update(tournaments)
      .set({ status: 'knockout', updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
  });
  return { progressed: true, qualifiers: qualifiers.length, rounds: totalRounds };
}

export async function advanceKnockoutWinner(matchId: string) {
  const [fixture] = await db
    .select({
      id: tournamentFixtures.id,
      tournamentId: tournamentFixtures.tournamentId,
      targetId: tournamentFixtures.advancesToFixtureId,
      targetPosition: tournamentFixtures.advancesToPosition,
      winnerId: matches.winnerId,
      clubId: tournaments.clubId,
      rulesId: tournaments.rulesId,
    })
    .from(tournamentFixtures)
    .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
    .innerJoin(tournaments, eq(tournaments.id, tournamentFixtures.tournamentId))
    .where(and(eq(tournamentFixtures.matchId, matchId), eq(tournamentFixtures.stage, 'knockout')))
    .limit(1);
  if (!fixture?.winnerId) return { progressed: false };
  if (!fixture.targetId) {
    await db
      .update(tournaments)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(tournaments.id, fixture.tournamentId));
    return { progressed: true, completed: true };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(tournamentFixtures)
      .set(
        fixture.targetPosition === 1
          ? { playerOneId: fixture.winnerId }
          : { playerTwoId: fixture.winnerId },
      )
      .where(eq(tournamentFixtures.id, fixture.targetId as string));
    const [target] = await tx
      .select()
      .from(tournamentFixtures)
      .where(eq(tournamentFixtures.id, fixture.targetId as string))
      .limit(1);
    if (target?.playerOneId && target.playerTwoId && !target.matchId) {
      const [match] = await tx
        .insert(matches)
        .values({
          clubId: fixture.clubId,
          source: 'tournament',
          countsForStatistics: true,
          status: 'scheduled',
          rulesId: fixture.rulesId,
        })
        .returning();
      if (!match) throw new Error('Failed to create next knockout match.');
      await tx.insert(matchParticipants).values([
        { matchId: match.id, userId: target.playerOneId, position: 1 },
        { matchId: match.id, userId: target.playerTwoId, position: 2 },
      ]);
      await tx
        .update(tournamentFixtures)
        .set({ matchId: match.id })
        .where(eq(tournamentFixtures.id, target.id));
    }
  });
  return { progressed: true, completed: false };
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
    bestOf: record.bestOf as 1 | 3 | 5 | 7,
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

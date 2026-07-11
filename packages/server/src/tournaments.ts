import type {
  CreateTournamentInput,
  OrganizerTiebreakDecisionInput,
  OrganizerTiebreakRequirement,
  TournamentEntryRequest,
  TournamentInvitation,
  TournamentManagement,
  TournamentParticipation,
  TournamentPlayer,
  TournamentPlayerCandidate,
  TournamentVisibility,
} from '@squash/contracts';
import {
  clubMemberships,
  clubResponsibilities,
  clubs,
  auditLogs,
  matches,
  matchParticipants,
  matchRuleSnapshots,
  organizerTiebreakDecisions,
  outboxEvents,
  tournamentEntryRequests,
  tournamentFixtures,
  tournamentGroupMembers,
  tournamentGroups,
  tournamentInvitations,
  tournamentOrganizers,
  tournamentParticipations,
  tournaments,
  users,
} from '@squash/db/schema';
import {
  assignPlayersToGroups,
  canPerformClubAction,
  createRoundRobinPairs,
  isExactOrganizerTiebreakOrder,
} from '@squash/domain';
import { and, asc, eq, exists, ilike, inArray, isNull, or } from 'drizzle-orm';
import { getClubAuthorization, requireLockedActiveClub } from './authorization';
import { db } from './database';
import { forbidden, notFound, ServiceError } from './errors';
import { getTournamentFixtureReadModel } from './tournament-fixture-read-model';
import { inspectTournamentProgression, progressTournament } from './tournament-progression';

type ReadDatabase = Pick<typeof db, 'select'>;
type TournamentAuthorityTarget = {
  id: string;
  clubId: string;
};

const preStartStatuses = ['draft', 'registration'] as const;

function ruleRecord(rules: { bestOf: number; pointsToWin: number; winByTwo: boolean }) {
  return { bestOf: rules.bestOf, pointsToWin: rules.pointsToWin, winByTwo: rules.winByTwo };
}

function isPreStart(status: string) {
  return preStartStatuses.includes(status as (typeof preStartStatuses)[number]);
}

function assertPreStart(status: string) {
  if (!isPreStart(status)) {
    throw new ServiceError('TOURNAMENT_ROSTER_LOCKED', 'error.invalidRequest', 409);
  }
}

function assertRegistrationOpen(status: string) {
  if (status !== 'registration') {
    throw new ServiceError('TOURNAMENT_REGISTRATION_NOT_OPEN', 'error.invalidRequest', 409);
  }
}

function assertQualifierConfiguration(input: {
  qualifiersPerGroup: number;
  wildcardQualifiers: number;
  groupSizes: readonly number[];
}) {
  const { groupSizes, qualifiersPerGroup, wildcardQualifiers } = input;
  const smallestGroupSize = Math.min(...groupSizes);
  if (qualifiersPerGroup >= smallestGroupSize) {
    throw new ServiceError('TOURNAMENT_QUALIFIERS_INVALID', 'error.invalidRequest', 409);
  }
  if (wildcardQualifiers > groupSizes.length) {
    throw new ServiceError('TOURNAMENT_WILDCARDS_INVALID', 'error.invalidRequest', 409);
  }
  if (groupSizes.length * qualifiersPerGroup + wildcardQualifiers < 2) {
    throw new ServiceError('TOURNAMENT_QUALIFIERS_INVALID', 'error.invalidRequest', 409);
  }
}

export async function requireTournamentManager(
  actorId: string,
  tournamentId: string,
  database: ReadDatabase = db,
) {
  const [tournament] = await database
    .select({ id: tournaments.id, clubId: tournaments.clubId })
    .from(tournaments)
    .innerJoin(clubs, eq(clubs.id, tournaments.clubId))
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw notFound('TOURNAMENT_NOT_FOUND');
  await requireTournamentAuthority(actorId, tournament, database);
  return tournament;
}

export async function requireTournamentAuthority(
  actorId: string,
  tournament: TournamentAuthorityTarget,
  database: ReadDatabase = db,
) {
  const authorization = await getClubAuthorization(actorId, tournament.clubId, database);
  if (authorization?.membershipStatus !== 'active') throw forbidden();
  if (authorization.clubArchivedAt) {
    throw new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409);
  }
  if (
    canPerformClubAction(
      authorization.platformRole,
      authorization.membershipStatus,
      authorization.responsibilities,
      'tournament.manage',
    )
  ) {
    return;
  }
  if (!authorization.responsibilities.includes('coach')) throw forbidden();
  const [appointment] = await database
    .select({ userId: tournamentOrganizers.userId })
    .from(tournamentOrganizers)
    .where(
      and(
        eq(tournamentOrganizers.tournamentId, tournament.id),
        eq(tournamentOrganizers.userId, actorId),
      ),
    )
    .limit(1);
  if (!appointment) throw forbidden();
}

export async function requireLockedTournamentAuthority(
  actorId: string,
  tournament: TournamentAuthorityTarget,
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await requireLockedActiveClub(database, tournament.clubId);
  await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1)
    .for('update');
  await database
    .select({ status: clubMemberships.status })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, tournament.clubId), eq(clubMemberships.userId, actorId)))
    .limit(1)
    .for('update');
  await database
    .select({ responsibility: clubResponsibilities.responsibility })
    .from(clubResponsibilities)
    .where(
      and(
        eq(clubResponsibilities.clubId, tournament.clubId),
        eq(clubResponsibilities.userId, actorId),
      ),
    )
    .for('update');
  const authorization = await getClubAuthorization(actorId, tournament.clubId, database);
  if (authorization?.membershipStatus !== 'active') throw forbidden();
  if (
    canPerformClubAction(
      authorization.platformRole,
      authorization.membershipStatus,
      authorization.responsibilities,
      'tournament.manage',
    )
  ) {
    return;
  }
  if (!authorization.responsibilities.includes('coach')) throw forbidden();
  const [appointment] = await database
    .select({ userId: tournamentOrganizers.userId })
    .from(tournamentOrganizers)
    .where(
      and(
        eq(tournamentOrganizers.tournamentId, tournament.id),
        eq(tournamentOrganizers.userId, actorId),
      ),
    )
    .limit(1)
    .for('update');
  if (!appointment) throw forbidden();
}

async function requireTournamentCreator(actorId: string, clubId: string, database: ReadDatabase) {
  const authorization = await getClubAuthorization(actorId, clubId, database);
  if (
    !authorization?.clubId ||
    !canPerformClubAction(
      authorization.platformRole,
      authorization.membershipStatus,
      authorization.responsibilities,
      'tournament.manage',
    )
  ) {
    throw forbidden();
  }
  if (authorization.clubArchivedAt) {
    throw new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409);
  }
}

async function lockTournament(
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tournamentId: string,
) {
  const [tournament] = await database
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1)
    .for('update');
  if (!tournament) throw notFound('TOURNAMENT_NOT_FOUND');
  return tournament;
}

async function lockAuthorizedTournament(
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
  actorId: string,
  tournamentId: string,
) {
  const tournament = await lockTournament(database, tournamentId);
  await requireTournamentAuthority(
    actorId,
    { id: tournament.id, clubId: tournament.clubId },
    database,
  );
  return tournament;
}

function tournamentManagementTransaction<T>(
  operation: (database: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
) {
  return db.transaction(operation, { isolationLevel: 'serializable' });
}

async function assertNoTournamentRelationship(
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tournamentId: string,
  playerId: string,
) {
  const [participation] = await database
    .select({ playerId: tournamentParticipations.playerId })
    .from(tournamentParticipations)
    .where(
      and(
        eq(tournamentParticipations.tournamentId, tournamentId),
        eq(tournamentParticipations.playerId, playerId),
      ),
    )
    .limit(1);
  if (participation) {
    throw new ServiceError('TOURNAMENT_PARTICIPATION_EXISTS', 'error.invalidRequest', 409);
  }
  const [request] = await database
    .select({ id: tournamentEntryRequests.id })
    .from(tournamentEntryRequests)
    .where(
      and(
        eq(tournamentEntryRequests.tournamentId, tournamentId),
        eq(tournamentEntryRequests.playerId, playerId),
        eq(tournamentEntryRequests.status, 'pending'),
      ),
    )
    .limit(1);
  const [invitation] = await database
    .select({ id: tournamentInvitations.id })
    .from(tournamentInvitations)
    .where(
      and(
        eq(tournamentInvitations.tournamentId, tournamentId),
        eq(tournamentInvitations.playerId, playerId),
        eq(tournamentInvitations.status, 'pending'),
      ),
    )
    .limit(1);
  if (request || invitation) {
    throw new ServiceError('TOURNAMENT_RELATIONSHIP_PENDING', 'error.invalidRequest', 409);
  }
}

async function invalidateDraftDraw(
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tournamentId: string,
) {
  await database.delete(tournamentGroups).where(eq(tournamentGroups.tournamentId, tournamentId));
  await database
    .update(tournaments)
    .set({ draftDrawGeneratedAt: null, updatedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));
}

async function addParticipation(
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    tournamentId: string;
    playerId: string;
    source: 'entry-request' | 'invitation' | 'direct';
    acceptedById: string;
  },
) {
  const [participation] = await database
    .insert(tournamentParticipations)
    .values(input)
    .onConflictDoNothing()
    .returning();
  if (!participation) {
    throw new ServiceError('TOURNAMENT_PARTICIPATION_EXISTS', 'error.invalidRequest', 409);
  }
  await invalidateDraftDraw(database, input.tournamentId);
  return participation;
}

export async function createTournament(actorId: string, input: CreateTournamentInput) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: clubs.id })
      .from(clubs)
      .where(eq(clubs.id, input.clubId))
      .limit(1)
      .for('update');
    await requireTournamentCreator(actorId, input.clubId, tx);
    const [rules] = await tx.insert(matchRuleSnapshots).values(ruleRecord(input.rules)).returning();
    if (!rules) throw new Error('Failed to create Tournament rules.');
    const [tournament] = await tx
      .insert(tournaments)
      .values({
        clubId: input.clubId,
        organizerId: actorId,
        name: input.name,
        visibility: input.visibility,
        startsAt: new Date(input.startsAt),
        timeZone: input.timeZone,
        groupSize: input.groupSize,
        qualifiersPerGroup: input.qualifiersPerGroup,
        wildcardQualifiers: input.wildcardQualifiers,
        seedingMethod: input.seedingMethod,
        rulesId: rules.id,
      })
      .returning();
    if (!tournament) throw new Error('Failed to create Tournament.');
    return tournament;
  });
}

export async function openTournamentRegistration(actorId: string, tournamentId: string) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    if (tournament.status !== 'draft') {
      throw new ServiceError('TOURNAMENT_NOT_DRAFT', 'error.invalidRequest', 409);
    }
    const [opened] = await tx
      .update(tournaments)
      .set({ status: 'registration', updatedAt: new Date() })
      .where(and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'draft')))
      .returning();
    if (!opened) throw new ServiceError('TOURNAMENT_STATE_CONFLICT', 'error.invalidRequest', 409);
    return opened;
  });
}

export async function updateTournamentVisibility(
  actorId: string,
  tournamentId: string,
  visibility: TournamentVisibility,
) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    assertPreStart(tournament.status);
    const [updated] = await tx
      .update(tournaments)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId))
      .returning();
    return updated;
  });
}

export async function listDiscoverableTournaments(actorId: string): Promise<TournamentPlayer[]> {
  const [player] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!player) throw forbidden();
  const activeMembership = db
    .select({ clubId: clubMemberships.clubId })
    .from(clubMemberships)
    .where(
      and(
        eq(clubMemberships.clubId, tournaments.clubId),
        eq(clubMemberships.userId, actorId),
        eq(clubMemberships.status, 'active'),
      ),
    );
  const rows = await db
    .select({
      id: tournaments.id,
      clubId: tournaments.clubId,
      clubName: clubs.name,
      name: tournaments.name,
      visibility: tournaments.visibility,
      status: tournaments.status,
      startsAt: tournaments.startsAt,
      timeZone: tournaments.timeZone,
      participantId: tournamentParticipations.playerId,
      entryRequestId: tournamentEntryRequests.id,
      invitationId: tournamentInvitations.id,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(clubs.id, tournaments.clubId))
    .leftJoin(
      tournamentParticipations,
      and(
        eq(tournamentParticipations.tournamentId, tournaments.id),
        eq(tournamentParticipations.playerId, actorId),
      ),
    )
    .leftJoin(
      tournamentEntryRequests,
      and(
        eq(tournamentEntryRequests.tournamentId, tournaments.id),
        eq(tournamentEntryRequests.playerId, actorId),
        eq(tournamentEntryRequests.status, 'pending'),
      ),
    )
    .leftJoin(
      tournamentInvitations,
      and(
        eq(tournamentInvitations.tournamentId, tournaments.id),
        eq(tournamentInvitations.playerId, actorId),
        eq(tournamentInvitations.status, 'pending'),
      ),
    )
    .where(
      and(
        eq(tournaments.status, 'registration'),
        isNull(clubs.archivedAt),
        or(
          eq(tournaments.visibility, 'public'),
          exists(activeMembership),
          eq(tournamentParticipations.playerId, actorId),
          eq(tournamentEntryRequests.playerId, actorId),
          eq(tournamentInvitations.playerId, actorId),
        ),
      ),
    )
    .orderBy(asc(tournaments.startsAt), asc(tournaments.name));
  return rows.map((row) => ({
    ...row,
    status: 'registration',
    startsAt: row.startsAt.toISOString(),
    relationship: row.participantId
      ? 'accepted'
      : row.entryRequestId
        ? 'request-pending'
        : row.invitationId
          ? 'invited'
          : 'none',
  }));
}

export async function requestTournamentEntry(actorId: string, tournamentId: string) {
  return db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertRegistrationOpen(tournament.status);
    const [player] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (!player) throw forbidden();
    const [membership] = await tx
      .select({ status: clubMemberships.status })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, tournament.clubId),
          eq(clubMemberships.userId, actorId),
          eq(clubMemberships.status, 'active'),
        ),
      )
      .limit(1);
    if (tournament.visibility === 'club-only' && !membership) throw forbidden();
    await assertNoTournamentRelationship(tx, tournamentId, actorId);
    const [request] = await tx
      .insert(tournamentEntryRequests)
      .values({ tournamentId, playerId: actorId })
      .returning();
    if (!request) throw new Error('Failed to create Tournament Entry Request.');
    return request;
  });
}

export async function inviteTournamentPlayer(
  actorId: string,
  tournamentId: string,
  playerId: string,
) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    assertRegistrationOpen(tournament.status);
    const [player] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, playerId))
      .limit(1);
    if (!player) throw notFound('PLAYER_NOT_FOUND');
    await assertNoTournamentRelationship(tx, tournamentId, playerId);
    const [invitation] = await tx
      .insert(tournamentInvitations)
      .values({ tournamentId, playerId, invitedById: actorId })
      .returning();
    if (!invitation) throw new Error('Failed to create Tournament Invitation.');
    return invitation;
  });
}

export async function respondToTournamentInvitation(
  actorId: string,
  tournamentId: string,
  invitationId: string,
  accept: boolean,
) {
  return db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertRegistrationOpen(tournament.status);
    const [invitation] = await tx
      .select()
      .from(tournamentInvitations)
      .where(
        and(
          eq(tournamentInvitations.id, invitationId),
          eq(tournamentInvitations.tournamentId, tournamentId),
        ),
      )
      .limit(1)
      .for('update');
    if (!invitation) throw notFound('TOURNAMENT_INVITATION_NOT_FOUND');
    if (invitation.playerId !== actorId) throw forbidden();
    if (invitation.status !== 'pending') {
      throw new ServiceError('TOURNAMENT_INVITATION_NOT_PENDING', 'error.invalidRequest', 409);
    }
    if (accept) {
      const [participation] = await tx
        .select({ playerId: tournamentParticipations.playerId })
        .from(tournamentParticipations)
        .where(
          and(
            eq(tournamentParticipations.tournamentId, tournamentId),
            eq(tournamentParticipations.playerId, actorId),
          ),
        )
        .limit(1);
      if (participation) {
        throw new ServiceError('TOURNAMENT_PARTICIPATION_EXISTS', 'error.invalidRequest', 409);
      }
      await addParticipation(tx, {
        tournamentId,
        playerId: actorId,
        source: 'invitation',
        acceptedById: actorId,
      });
    }
    const [responded] = await tx
      .update(tournamentInvitations)
      .set({ status: accept ? 'accepted' : 'rejected', respondedAt: new Date() })
      .where(
        and(
          eq(tournamentInvitations.id, invitationId),
          eq(tournamentInvitations.status, 'pending'),
        ),
      )
      .returning();
    if (!responded) {
      throw new ServiceError('TOURNAMENT_INVITATION_NOT_PENDING', 'error.invalidRequest', 409);
    }
    return responded;
  });
}

export async function decideTournamentEntryRequest(
  actorId: string,
  tournamentId: string,
  requestId: string,
  approve: boolean,
) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    assertRegistrationOpen(tournament.status);
    const [request] = await tx
      .select()
      .from(tournamentEntryRequests)
      .where(
        and(
          eq(tournamentEntryRequests.id, requestId),
          eq(tournamentEntryRequests.tournamentId, tournamentId),
        ),
      )
      .limit(1)
      .for('update');
    if (!request) throw notFound('TOURNAMENT_ENTRY_REQUEST_NOT_FOUND');
    if (request.status !== 'pending') {
      throw new ServiceError('TOURNAMENT_ENTRY_REQUEST_NOT_PENDING', 'error.invalidRequest', 409);
    }
    if (approve) {
      await addParticipation(tx, {
        tournamentId,
        playerId: request.playerId,
        source: 'entry-request',
        acceptedById: actorId,
      });
    }
    const [resolved] = await tx
      .update(tournamentEntryRequests)
      .set({
        status: approve ? 'approved' : 'rejected',
        resolvedAt: new Date(),
        resolvedById: actorId,
      })
      .where(
        and(
          eq(tournamentEntryRequests.id, requestId),
          eq(tournamentEntryRequests.status, 'pending'),
        ),
      )
      .returning();
    if (!resolved) {
      throw new ServiceError('TOURNAMENT_ENTRY_REQUEST_NOT_PENDING', 'error.invalidRequest', 409);
    }
    return resolved;
  });
}

export async function directlyAddTournamentPlayer(
  actorId: string,
  tournamentId: string,
  playerId: string,
) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    assertPreStart(tournament.status);
    const [player] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, playerId))
      .limit(1);
    if (!player) throw notFound('PLAYER_NOT_FOUND');
    await assertNoTournamentRelationship(tx, tournamentId, playerId);
    return addParticipation(tx, {
      tournamentId,
      playerId,
      source: 'direct',
      acceptedById: actorId,
    });
  });
}

export async function withdrawTournamentParticipation(actorId: string, tournamentId: string) {
  return db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertPreStart(tournament.status);
    const [removed] = await tx
      .delete(tournamentParticipations)
      .where(
        and(
          eq(tournamentParticipations.tournamentId, tournamentId),
          eq(tournamentParticipations.playerId, actorId),
        ),
      )
      .returning();
    if (!removed) throw notFound('TOURNAMENT_PARTICIPATION_NOT_FOUND');
    await invalidateDraftDraw(tx, tournamentId);
    return { tournamentId, playerId: actorId, withdrawn: true as const };
  });
}

export async function removeTournamentPlayer(
  actorId: string,
  tournamentId: string,
  playerId: string,
) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    assertPreStart(tournament.status);
    const [removed] = await tx
      .delete(tournamentParticipations)
      .where(
        and(
          eq(tournamentParticipations.tournamentId, tournamentId),
          eq(tournamentParticipations.playerId, playerId),
        ),
      )
      .returning();
    if (!removed) throw notFound('TOURNAMENT_PARTICIPATION_NOT_FOUND');
    await invalidateDraftDraw(tx, tournamentId);
    return { tournamentId, playerId, removed: true as const };
  });
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

export async function generateTournamentDraftDraw(actorId: string, tournamentId: string) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    if (tournament.status !== 'registration') {
      throw new ServiceError('TOURNAMENT_REGISTRATION_NOT_OPEN', 'error.invalidRequest', 409);
    }
    const participations = await tx
      .select({ playerId: tournamentParticipations.playerId, seed: tournamentParticipations.seed })
      .from(tournamentParticipations)
      .where(eq(tournamentParticipations.tournamentId, tournamentId))
      .orderBy(asc(tournamentParticipations.seed), asc(tournamentParticipations.acceptedAt));
    const ordered =
      tournament.seedingMethod === 'random' ? shuffled(participations) : participations;
    let assignments;
    try {
      assignments = assignPlayersToGroups(
        ordered.map((item) => item.playerId),
        tournament.groupSize,
      );
    } catch {
      throw new ServiceError('TOURNAMENT_DRAW_REQUIRES_PLAYERS', 'error.invalidRequest', 409);
    }
    assertQualifierConfiguration({
      qualifiersPerGroup: tournament.qualifiersPerGroup,
      wildcardQualifiers: tournament.wildcardQualifiers ?? 0,
      groupSizes: assignments.map((assignment) => assignment.playerIds.length),
    });
    await tx.delete(tournamentGroups).where(eq(tournamentGroups.tournamentId, tournamentId));
    for (const assignment of assignments) {
      const [group] = await tx
        .insert(tournamentGroups)
        .values({
          tournamentId,
          name: String.fromCharCode(64 + assignment.groupPosition),
          position: assignment.groupPosition,
        })
        .returning();
      if (!group) throw new Error('Failed to create Tournament Group.');
      await tx.insert(tournamentGroupMembers).values(
        assignment.playerIds.map((playerId) => ({
          groupId: group.id,
          userId: playerId,
          seed: participations.find((item) => item.playerId === playerId)?.seed,
        })),
      );
    }
    const generatedAt = new Date();
    await tx
      .update(tournaments)
      .set({ draftDrawGeneratedAt: generatedAt, updatedAt: generatedAt })
      .where(eq(tournaments.id, tournamentId));
    return { tournamentId, groups: assignments.length, players: participations.length };
  });
}

export async function startTournament(actorId: string, tournamentId: string) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
    assertRegistrationOpen(tournament.status);
    if (!tournament.draftDrawGeneratedAt) {
      throw new ServiceError('TOURNAMENT_DRAFT_DRAW_REQUIRED', 'error.invalidRequest', 409);
    }

    const participations = await tx
      .select({ playerId: tournamentParticipations.playerId })
      .from(tournamentParticipations)
      .where(eq(tournamentParticipations.tournamentId, tournamentId))
      .orderBy(asc(tournamentParticipations.acceptedAt));
    if (participations.length < 3) {
      throw new ServiceError(
        'TOURNAMENT_START_REQUIRES_THREE_PLAYERS',
        'error.invalidRequest',
        409,
      );
    }

    const groups = await tx
      .select({ id: tournamentGroups.id, position: tournamentGroups.position })
      .from(tournamentGroups)
      .where(eq(tournamentGroups.tournamentId, tournamentId))
      .orderBy(asc(tournamentGroups.position));
    if (groups.length === 0) {
      throw new ServiceError('TOURNAMENT_DRAFT_DRAW_REQUIRED', 'error.invalidRequest', 409);
    }

    const groupMembers = await tx
      .select({
        groupId: tournamentGroupMembers.groupId,
        playerId: tournamentGroupMembers.userId,
        seed: tournamentGroupMembers.seed,
      })
      .from(tournamentGroupMembers)
      .where(
        inArray(
          tournamentGroupMembers.groupId,
          groups.map((group) => group.id),
        ),
      )
      .orderBy(asc(tournamentGroupMembers.seed), asc(tournamentGroupMembers.userId));

    const acceptedPlayerIds = new Set(
      participations.map((participation) => participation.playerId),
    );
    const drawnPlayerIds = new Set(groupMembers.map((member) => member.playerId));
    if (
      drawnPlayerIds.size !== groupMembers.length ||
      drawnPlayerIds.size !== acceptedPlayerIds.size ||
      [...acceptedPlayerIds].some((playerId) => !drawnPlayerIds.has(playerId))
    ) {
      throw new ServiceError('TOURNAMENT_DRAFT_DRAW_STALE', 'error.invalidRequest', 409);
    }

    const membersByGroup = new Map<string, string[]>();
    for (const group of groups) membersByGroup.set(group.id, []);
    for (const member of groupMembers) {
      membersByGroup.get(member.groupId)?.push(member.playerId);
    }
    const groupSizes = [...membersByGroup.values()].map((playerIds) => playerIds.length);
    if (groupSizes.some((size) => size < 2)) {
      throw new ServiceError('TOURNAMENT_DRAFT_DRAW_INVALID', 'error.invalidRequest', 409);
    }
    if (Math.max(...groupSizes) - Math.min(...groupSizes) > 1) {
      throw new ServiceError('TOURNAMENT_DRAFT_DRAW_INVALID', 'error.invalidRequest', 409);
    }
    assertQualifierConfiguration({
      qualifiersPerGroup: tournament.qualifiersPerGroup,
      wildcardQualifiers: tournament.wildcardQualifiers ?? 0,
      groupSizes,
    });

    let fixtureCount = 0;
    const nextFixturePositionByRound = new Map<number, number>();
    for (const group of groups) {
      const playerIds = membersByGroup.get(group.id) ?? [];
      for (const pair of createRoundRobinPairs(playerIds)) {
        const position = nextFixturePositionByRound.get(pair.round) ?? 1;
        nextFixturePositionByRound.set(pair.round, position + 1);
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
        if (!match) throw new Error('Failed to create group Match.');
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
          position,
          playerOneId: pair.playerOneId,
          playerTwoId: pair.playerTwoId,
        });
        fixtureCount += 1;
      }
    }

    const [started] = await tx
      .update(tournaments)
      .set({ status: 'group-stage', updatedAt: new Date() })
      .where(and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'registration')))
      .returning();
    if (!started) throw new ServiceError('TOURNAMENT_STATE_CONFLICT', 'error.invalidRequest', 409);
    return {
      tournamentId,
      status: 'group-stage' as const,
      players: participations.length,
      groups: groups.length,
      fixtures: fixtureCount,
    };
  });
}

const serializeEntryRequest = (row: {
  id: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  playerImage: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  resolvedAt: Date | null;
  resolvedById: string | null;
}): TournamentEntryRequest => ({
  ...row,
  submittedAt: row.submittedAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
});

const serializeInvitation = (row: {
  id: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  playerImage: string | null;
  invitedById: string;
  status: 'pending' | 'accepted' | 'rejected';
  invitedAt: Date;
  respondedAt: Date | null;
}): TournamentInvitation => ({
  ...row,
  invitedAt: row.invitedAt.toISOString(),
  respondedAt: row.respondedAt?.toISOString() ?? null,
});

const serializeParticipation = (row: {
  tournamentId: string;
  playerId: string;
  playerName: string;
  playerImage: string | null;
  source: 'entry-request' | 'invitation' | 'direct';
  acceptedAt: Date;
}): TournamentParticipation => ({
  ...row,
  acceptedAt: row.acceptedAt.toISOString(),
});

export async function getTournamentManagement(
  actorId: string,
  tournamentId: string,
): Promise<TournamentManagement> {
  await requireTournamentManager(actorId, tournamentId);
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw notFound('TOURNAMENT_NOT_FOUND');
  const entryRequests = await db
    .select({
      id: tournamentEntryRequests.id,
      tournamentId: tournamentEntryRequests.tournamentId,
      playerId: tournamentEntryRequests.playerId,
      playerName: users.name,
      playerImage: users.image,
      status: tournamentEntryRequests.status,
      submittedAt: tournamentEntryRequests.submittedAt,
      resolvedAt: tournamentEntryRequests.resolvedAt,
      resolvedById: tournamentEntryRequests.resolvedById,
    })
    .from(tournamentEntryRequests)
    .innerJoin(users, eq(users.id, tournamentEntryRequests.playerId))
    .where(eq(tournamentEntryRequests.tournamentId, tournamentId))
    .orderBy(asc(tournamentEntryRequests.submittedAt));
  const invitations = await db
    .select({
      id: tournamentInvitations.id,
      tournamentId: tournamentInvitations.tournamentId,
      playerId: tournamentInvitations.playerId,
      playerName: users.name,
      playerImage: users.image,
      invitedById: tournamentInvitations.invitedById,
      status: tournamentInvitations.status,
      invitedAt: tournamentInvitations.invitedAt,
      respondedAt: tournamentInvitations.respondedAt,
    })
    .from(tournamentInvitations)
    .innerJoin(users, eq(users.id, tournamentInvitations.playerId))
    .where(eq(tournamentInvitations.tournamentId, tournamentId))
    .orderBy(asc(tournamentInvitations.invitedAt));
  const participations = await db
    .select({
      tournamentId: tournamentParticipations.tournamentId,
      playerId: tournamentParticipations.playerId,
      playerName: users.name,
      playerImage: users.image,
      source: tournamentParticipations.source,
      acceptedAt: tournamentParticipations.acceptedAt,
    })
    .from(tournamentParticipations)
    .innerJoin(users, eq(users.id, tournamentParticipations.playerId))
    .where(eq(tournamentParticipations.tournamentId, tournamentId))
    .orderBy(asc(tournamentParticipations.acceptedAt));
  const fixtureReadModel = await getTournamentFixtureReadModel(tournament);
  const progressionState = await inspectTournamentProgression(tournamentId);
  let organizerTiebreakRequirement: OrganizerTiebreakRequirement | null = null;
  if (progressionState.status === 'manual-tiebreak-required') {
    const playerRows = await db
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(inArray(users.id, [...progressionState.requirement.playerIds]));
    const playersById = new Map(playerRows.map((player) => [player.id, player]));
    const players = progressionState.requirement.playerIds.map((playerId) => {
      const player = playersById.get(playerId);
      if (!player) throw new Error('A tied Player could not be loaded.');
      return player;
    });
    const groupFixture = progressionState.requirement.groupId
      ? fixtureReadModel.groupFixtures.find(
          (fixture) => fixture.groupId === progressionState.requirement.groupId,
        )
      : null;
    if (progressionState.requirement.groupId && !groupFixture) {
      throw new Error('The tied Group could not be loaded.');
    }
    organizerTiebreakRequirement = {
      context: progressionState.requirement.context,
      group: progressionState.requirement.groupId
        ? {
            id: progressionState.requirement.groupId,
            name: groupFixture?.groupName as string,
          }
        : null,
      players,
      requirementKey: progressionState.requirement.requirementKey,
    };
  }
  return {
    id: tournament.id,
    clubId: tournament.clubId,
    name: tournament.name,
    visibility: tournament.visibility,
    status: tournament.status,
    startsAt: tournament.startsAt.toISOString(),
    timeZone: tournament.timeZone,
    groupSize: tournament.groupSize,
    qualifiersPerGroup: tournament.qualifiersPerGroup,
    wildcardQualifiers: tournament.wildcardQualifiers,
    draftDrawGeneratedAt: tournament.draftDrawGeneratedAt?.toISOString() ?? null,
    entryRequests: entryRequests.map(serializeEntryRequest),
    invitations: invitations.map(serializeInvitation),
    participations: participations.map(serializeParticipation),
    ...fixtureReadModel,
    organizerTiebreakRequirement,
  };
}

function requireCurrentValidTiebreakRequirement(
  progressionState: Awaited<ReturnType<typeof inspectTournamentProgression>>,
  input: OrganizerTiebreakDecisionInput,
) {
  if (
    progressionState.status !== 'manual-tiebreak-required' ||
    progressionState.requirement.requirementKey !== input.requirementKey
  ) {
    throw new ServiceError('ORGANIZER_TIEBREAK_STALE', 'error.invalidRequest', 409);
  }
  if (
    !isExactOrganizerTiebreakOrder(progressionState.requirement.playerIds, input.orderedPlayerIds)
  ) {
    throw new ServiceError('ORGANIZER_TIEBREAK_ORDER_INVALID', 'error.invalidRequest', 400);
  }
  return progressionState.requirement;
}

export async function submitOrganizerTiebreakDecision(
  actorId: string,
  tournamentId: string,
  input: OrganizerTiebreakDecisionInput,
) {
  const decision = await db.transaction(
    async (tx) => {
      const tournament = await lockAuthorizedTournament(tx, actorId, tournamentId);
      const requirement = requireCurrentValidTiebreakRequirement(
        await inspectTournamentProgression(tournamentId, tx),
        input,
      );
      const [inserted] = await tx
        .insert(organizerTiebreakDecisions)
        .values({
          tournamentId,
          context: requirement.context,
          groupId: requirement.groupId,
          orderedPlayerIds: [...input.orderedPlayerIds],
          requirementKey: requirement.requirementKey,
          decidedById: actorId,
        })
        .returning();
      if (!inserted) throw new Error('Failed to record Organizer Tiebreak Decision.');
      await tx.insert(auditLogs).values({
        actorId,
        clubId: tournament.clubId,
        action: 'tournament.organizer-tiebreak-decide',
        entityType: 'organizer-tiebreak-decision',
        entityId: inserted.id,
        metadata: {
          tournamentId,
          context: requirement.context,
          groupId: requirement.groupId,
          orderedPlayerIds: input.orderedPlayerIds,
          requirementKey: requirement.requirementKey,
        },
      });
      await tx.insert(outboxEvents).values({
        topic: 'tournament.progress',
        aggregateId: inserted.id,
        payload: { tournamentId },
      });
      return inserted;
    },
    { isolationLevel: 'serializable' },
  );

  const progression = await progressTournament(tournamentId);
  return {
    decision: {
      ...decision,
      decidedAt: decision.decidedAt.toISOString(),
    },
    progression,
  };
}

export async function listClubTournaments(actorId: string, clubId: string) {
  const authorization = await getClubAuthorization(actorId, clubId);
  if (authorization?.membershipStatus !== 'active') throw forbidden();
  const managesEveryTournament = canPerformClubAction(
    authorization.platformRole,
    authorization.membershipStatus,
    authorization.responsibilities,
    'tournament.manage',
  );
  if (!managesEveryTournament && !authorization.responsibilities.includes('coach')) {
    throw forbidden();
  }
  const rows = managesEveryTournament
    ? await db
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(eq(tournaments.clubId, clubId))
        .orderBy(asc(tournaments.startsAt))
    : await db
        .select({ id: tournaments.id })
        .from(tournaments)
        .innerJoin(tournamentOrganizers, eq(tournamentOrganizers.tournamentId, tournaments.id))
        .where(and(eq(tournaments.clubId, clubId), eq(tournamentOrganizers.userId, actorId)))
        .orderBy(asc(tournaments.startsAt));
  return Promise.all(rows.map((row) => getTournamentManagement(actorId, row.id)));
}

export async function listTournamentPlayerCandidates(
  actorId: string,
  tournamentId: string,
  search: string,
): Promise<TournamentPlayerCandidate[]> {
  await requireTournamentManager(actorId, tournamentId);
  return db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(search ? ilike(users.name, `%${search}%`) : undefined)
    .orderBy(asc(users.name))
    .limit(50);
}

export async function appointTournamentCoach(
  actorId: string,
  tournamentId: string,
  coachId: string,
) {
  return tournamentManagementTransaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    await requireTournamentCreator(actorId, tournament.clubId, tx);
    const [coach] = await tx
      .select({ userId: clubMemberships.userId })
      .from(clubMemberships)
      .innerJoin(
        clubResponsibilities,
        and(
          eq(clubResponsibilities.clubId, clubMemberships.clubId),
          eq(clubResponsibilities.userId, clubMemberships.userId),
        ),
      )
      .where(
        and(
          eq(clubMemberships.clubId, tournament.clubId),
          eq(clubMemberships.userId, coachId),
          eq(clubMemberships.status, 'active'),
          eq(clubResponsibilities.responsibility, 'coach'),
        ),
      )
      .limit(1);
    if (!coach) {
      throw new ServiceError('TOURNAMENT_ORGANIZER_MUST_BE_COACH', 'error.invalidRequest', 409);
    }
    await tx
      .insert(tournamentOrganizers)
      .values({ tournamentId, userId: coachId })
      .onConflictDoNothing();
    return { tournamentId, coachId };
  });
}

import { officialResultInputSchema, type OfficialResultInput } from '@squash/contracts';
import {
  auditLogs,
  matches,
  matchParticipants,
  matchResultRevisions,
  matchRuleSnapshots,
  matchSets,
  outboxEvents,
  tournamentFixtures,
  tournaments,
} from '@squash/db/schema';
import { calculateMatchResult, InvalidScoreError } from '@squash/domain';
import { and, eq } from 'drizzle-orm';
import { db } from './database';
import { notFound, ServiceError } from './errors';
import { evaluateOfficialResultCorrectionStatus } from './official-result-locks';
import { rebuildOfficialTournamentStatisticsForMatch } from './official-tournament-statistics';
import { requireLockedTournamentAuthority } from './tournaments';

type OfficialResultTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function invalid(code: string, status = 409) {
  return new ServiceError(code, 'error.invalidRequest', status);
}

export function parseOfficialResultInput(input: unknown): OfficialResultInput {
  const parsed = officialResultInputSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  if (parsed.error.issues.some((issue) => issue.path[0] === 'games')) {
    throw invalid('OFFICIAL_RESULT_GAMES_INVALID', 400);
  }
  if (parsed.error.issues.some((issue) => issue.path[0] === 'reason')) {
    throw invalid('OFFICIAL_RESULT_REASON_REQUIRED', 400);
  }
  throw invalid('OFFICIAL_RESULT_REQUEST_INVALID', 400);
}

function correctionStatusError(status: ReturnType<typeof evaluateOfficialResultCorrectionStatus>) {
  return status === 'group-stage-advanced' || status === 'dependent-match-started'
    ? invalid('OFFICIAL_RESULT_LOCKED')
    : invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
}

function isSerializableRetry(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return code === '40001' || code === '40P01';
}

async function runSerializableOfficialResultOperation<T>(
  operation: (tx: OfficialResultTransaction) => Promise<T>,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.transaction(operation, { isolationLevel: 'serializable' });
    } catch (error) {
      if (!isSerializableRetry(error)) throw error;
    }
  }
  throw invalid('OFFICIAL_RESULT_CONFLICT');
}

async function lockOfficialTournamentFixture(tx: OfficialResultTransaction, fixtureId: string) {
  const [fixture] = await tx
    .select({
      fixtureId: tournamentFixtures.id,
      fixtureTournamentId: tournamentFixtures.tournamentId,
      tournamentId: tournaments.id,
      clubId: tournaments.clubId,
      tournamentStatus: tournaments.status,
      stage: tournamentFixtures.stage,
      matchId: matches.id,
      matchSource: matches.source,
      matchStatus: matches.status,
      currentRevision: matches.currentRevision,
      playerOneId: tournamentFixtures.playerOneId,
      playerTwoId: tournamentFixtures.playerTwoId,
    })
    .from(tournamentFixtures)
    .innerJoin(tournaments, eq(tournaments.id, tournamentFixtures.tournamentId))
    .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
    .where(eq(tournamentFixtures.id, fixtureId))
    .limit(1)
    .for('update');
  if (!fixture) throw notFound('TOURNAMENT_FIXTURE_NOT_FOUND');
  return fixture;
}

async function lockOfficialResultState(tx: OfficialResultTransaction, fixtureId: string) {
  const [state] = await tx
    .select({
      round: tournamentFixtures.round,
      position: tournamentFixtures.position,
      groupId: tournamentFixtures.groupId,
      advancesToFixtureId: tournamentFixtures.advancesToFixtureId,
      advancesToPosition: tournamentFixtures.advancesToPosition,
      completedAt: matches.completedAt,
      currentWinnerId: matches.winnerId,
      bestOf: matchRuleSnapshots.bestOf,
      pointsToWin: matchRuleSnapshots.pointsToWin,
      winByTwo: matchRuleSnapshots.winByTwo,
    })
    .from(tournamentFixtures)
    .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
    .innerJoin(matchRuleSnapshots, eq(matchRuleSnapshots.id, matches.rulesId))
    .where(eq(tournamentFixtures.id, fixtureId))
    .limit(1)
    .for('update');
  if (!state) throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
  return state;
}

export async function beginOfficialTournamentMatch(
  organizerId: string,
  tournamentId: string,
  fixtureId: string,
) {
  return runSerializableOfficialResultOperation(async (tx) => {
    const fixture = await lockOfficialTournamentFixture(tx, fixtureId);
    await requireLockedTournamentAuthority(
      organizerId,
      { id: fixture.tournamentId, clubId: fixture.clubId },
      tx,
    );
    if (fixture.fixtureTournamentId !== tournamentId) {
      throw invalid('OFFICIAL_RESULT_FIXTURE_MISMATCH');
    }
    if (
      fixture.stage !== 'knockout' ||
      fixture.tournamentStatus !== 'knockout' ||
      fixture.matchSource !== 'tournament' ||
      !fixture.matchId ||
      !fixture.playerOneId ||
      !fixture.playerTwoId ||
      fixture.currentRevision !== 0
    ) {
      throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
    }
    if (fixture.matchStatus !== 'scheduled') {
      throw invalid('OFFICIAL_MATCH_ALREADY_BEGUN');
    }

    const beganAt = new Date();
    const [updated] = await tx
      .update(matches)
      .set({ status: 'in-progress', updatedAt: beganAt })
      .where(
        and(
          eq(matches.id, fixture.matchId),
          eq(matches.status, 'scheduled'),
          eq(matches.currentRevision, 0),
        ),
      )
      .returning({ id: matches.id });
    if (!updated) throw invalid('OFFICIAL_RESULT_CONFLICT');

    await tx.insert(auditLogs).values({
      actorId: organizerId,
      clubId: fixture.clubId,
      action: 'tournament.match-begin',
      entityType: 'match',
      entityId: fixture.matchId,
      metadata: { tournamentId, fixtureId, matchId: fixture.matchId, organizerId },
    });
    return {
      tournamentId,
      fixtureId,
      matchId: fixture.matchId,
      status: 'in-progress' as const,
      beganAt: beganAt.toISOString(),
    };
  });
}

export async function recordOfficialTournamentResult(
  organizerId: string,
  tournamentId: string,
  fixtureId: string,
  input: OfficialResultInput,
) {
  const operation = async (tx: OfficialResultTransaction) => {
    const lockedFixture = await lockOfficialTournamentFixture(tx, fixtureId);
    await requireLockedTournamentAuthority(
      organizerId,
      { id: lockedFixture.tournamentId, clubId: lockedFixture.clubId },
      tx,
    );
    if (lockedFixture.fixtureTournamentId !== tournamentId) {
      throw invalid('OFFICIAL_RESULT_FIXTURE_MISMATCH');
    }
    if (lockedFixture.matchSource !== 'tournament') {
      throw invalid('OFFICIAL_RESULT_MATCH_INVALID');
    }
    if (lockedFixture.currentRevision !== input.expectedRevision) {
      throw invalid('OFFICIAL_RESULT_STALE');
    }
    const fixture = {
      ...lockedFixture,
      ...(await lockOfficialResultState(tx, fixtureId)),
    };

    const isCorrection = fixture.currentRevision > 0;
    const correctionReason = input.reason?.trim() ?? null;
    const initialMatchStatus = fixture.stage === 'group' ? 'scheduled' : 'in-progress';
    if (isCorrection && !correctionReason) {
      throw invalid('OFFICIAL_RESULT_REASON_REQUIRED', 400);
    }
    if (
      isCorrection
        ? fixture.matchStatus !== 'completed'
        : fixture.matchStatus !== initialMatchStatus
    ) {
      throw invalid('OFFICIAL_RESULT_NOT_RECORDABLE');
    }
    if (
      !fixture.matchId ||
      !fixture.playerOneId ||
      !fixture.playerTwoId ||
      (fixture.stage === 'group' && !fixture.groupId)
    ) {
      throw invalid('OFFICIAL_RESULT_FIXTURE_UNAVAILABLE');
    }

    let dependentFixture:
      | {
          id: string;
          matchId: string | null;
          playerOneId: string | null;
          playerTwoId: string | null;
        }
      | undefined;
    let dependentMatchStatus:
      | 'scheduled'
      | 'in-progress'
      | 'completed'
      | 'disputed'
      | 'void'
      | null = null;
    if (fixture.advancesToFixtureId) {
      [dependentFixture] = await tx
        .select({
          id: tournamentFixtures.id,
          matchId: tournamentFixtures.matchId,
          playerOneId: tournamentFixtures.playerOneId,
          playerTwoId: tournamentFixtures.playerTwoId,
        })
        .from(tournamentFixtures)
        .where(
          and(
            eq(tournamentFixtures.id, fixture.advancesToFixtureId),
            eq(tournamentFixtures.tournamentId, tournamentId),
          ),
        )
        .limit(1)
        .for('update');
      if (!dependentFixture || !fixture.advancesToPosition) {
        throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
      }
      if (dependentFixture.matchId) {
        const [dependentMatch] = await tx
          .select({ status: matches.status })
          .from(matches)
          .where(eq(matches.id, dependentFixture.matchId))
          .limit(1)
          .for('update');
        if (!dependentMatch) throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
        dependentMatchStatus = dependentMatch.status;
      }
    }

    const initialLifecycleAllowsResult =
      (fixture.stage === 'group' && fixture.tournamentStatus === 'group-stage') ||
      (fixture.stage === 'knockout' && fixture.tournamentStatus === 'knockout');
    if (!isCorrection && !initialLifecycleAllowsResult) {
      throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
    }
    if (isCorrection) {
      const correctionStatus = evaluateOfficialResultCorrectionStatus({
        stage: fixture.stage,
        tournamentStatus: fixture.tournamentStatus,
        dependentMatchStatus,
      });
      if (correctionStatus !== 'unlocked') throw correctionStatusError(correctionStatus);
    }

    const participants = await tx
      .select({ userId: matchParticipants.userId, position: matchParticipants.position })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, fixture.matchId))
      .orderBy(matchParticipants.position)
      .for('update');
    if (
      participants.length !== 2 ||
      participants[0]?.position !== 1 ||
      participants[0]?.userId !== fixture.playerOneId ||
      participants[1]?.position !== 2 ||
      participants[1]?.userId !== fixture.playerTwoId
    ) {
      throw invalid('OFFICIAL_RESULT_PLAYERS_INVALID');
    }

    const previousGames = isCorrection
      ? await tx
          .select({
            playerOnePoints: matchSets.playerOnePoints,
            playerTwoPoints: matchSets.playerTwoPoints,
          })
          .from(matchSets)
          .where(eq(matchSets.matchId, fixture.matchId))
          .orderBy(matchSets.setNumber)
          .for('update')
      : [];

    let result;
    try {
      result = calculateMatchResult(input.games, {
        bestOf: fixture.bestOf as 1 | 3 | 5,
        pointsToWin: fixture.pointsToWin,
        winByTwo: fixture.winByTwo,
      });
    } catch (error) {
      if (error instanceof InvalidScoreError) {
        throw invalid('OFFICIAL_RESULT_GAMES_INVALID', 400);
      }
      throw error;
    }
    if (!result.completed || result.winner === null) {
      throw invalid('OFFICIAL_RESULT_GAMES_INVALID', 400);
    }

    const winnerId = result.winner === 1 ? fixture.playerOneId : fixture.playerTwoId;
    const changedAt = new Date();
    const completedAt = fixture.completedAt ?? changedAt;
    const revision = input.expectedRevision + 1;
    const [updated] = await tx
      .update(matches)
      .set({
        status: 'completed',
        completedAt,
        submittedById: organizerId,
        winnerId,
        currentRevision: revision,
        updatedAt: changedAt,
      })
      .where(
        and(
          eq(matches.id, fixture.matchId),
          eq(matches.status, isCorrection ? 'completed' : initialMatchStatus),
          eq(matches.currentRevision, input.expectedRevision),
        ),
      )
      .returning({ id: matches.id });
    if (!updated) throw invalid('OFFICIAL_RESULT_STALE');

    if (isCorrection) await tx.delete(matchSets).where(eq(matchSets.matchId, fixture.matchId));
    await tx.insert(matchSets).values(
      input.games.map((game, index) => ({
        matchId: fixture.matchId,
        setNumber: index + 1,
        ...game,
      })),
    );

    if (isCorrection && dependentFixture && winnerId !== fixture.currentWinnerId) {
      const targetPosition = fixture.advancesToPosition;
      if (!targetPosition) throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
      const playerField = targetPosition === 1 ? 'playerOneId' : 'playerTwoId';
      const expectedPlayerId = dependentFixture[playerField];
      if (expectedPlayerId !== fixture.currentWinnerId) {
        throw invalid('OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID');
      }
      await tx
        .update(tournamentFixtures)
        .set({ [playerField]: winnerId })
        .where(eq(tournamentFixtures.id, dependentFixture.id));
      if (dependentFixture.matchId) {
        await tx
          .delete(matchParticipants)
          .where(
            and(
              eq(matchParticipants.matchId, dependentFixture.matchId),
              eq(matchParticipants.position, targetPosition),
            ),
          );
        await tx.insert(matchParticipants).values({
          matchId: dependentFixture.matchId,
          userId: winnerId,
          position: targetPosition,
        });
      }
    }

    await tx.insert(matchResultRevisions).values({
      matchId: fixture.matchId,
      revision,
      submittedById: organizerId,
      reason: isCorrection ? correctionReason : null,
      result: { games: input.games, ...result, winnerId },
    });
    await tx.insert(auditLogs).values({
      actorId: organizerId,
      clubId: fixture.clubId,
      action: isCorrection
        ? 'tournament.official-result-correct'
        : 'tournament.official-result-record',
      entityType: 'match',
      entityId: fixture.matchId,
      metadata: {
        tournamentId,
        fixtureId,
        matchId: fixture.matchId,
        stage: fixture.stage,
        round: fixture.round,
        position: fixture.position,
        groupId: fixture.groupId,
        playerOneId: fixture.playerOneId,
        playerTwoId: fixture.playerTwoId,
        previousGames,
        previousWinnerId: fixture.currentWinnerId,
        games: input.games,
        winnerId,
        revision,
        reason: isCorrection ? correctionReason : null,
        organizerId,
        changedAt: changedAt.toISOString(),
      },
    });

    if (isCorrection) {
      await rebuildOfficialTournamentStatisticsForMatch(tx, fixture.matchId);
    }
    await tx.insert(outboxEvents).values([
      {
        topic: 'statistics.rebuild',
        aggregateId: fixture.matchId,
        payload: { matchId: fixture.matchId, source: 'tournament', revision },
      },
      {
        topic: 'tournament.progress',
        aggregateId: fixture.matchId,
        payload: { matchId: fixture.matchId, tournamentId, revision },
      },
    ]);

    return {
      tournamentId,
      fixtureId,
      matchId: fixture.matchId,
      winnerId,
      completedAt: completedAt.toISOString(),
      revision,
      games: input.games,
    };
  };

  return runSerializableOfficialResultOperation(operation);
}

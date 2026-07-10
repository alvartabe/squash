import type { OfficialResultInput } from '@squash/contracts';
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
import { requireTournamentManager } from './tournaments';

function invalid(code: string, status = 409) {
  return new ServiceError(code, 'error.invalidRequest', status);
}

export async function recordOfficialTournamentResult(
  organizerId: string,
  tournamentId: string,
  fixtureId: string,
  input: OfficialResultInput,
) {
  await requireTournamentManager(organizerId, tournamentId);

  return db.transaction(
    async (tx) => {
      const [fixture] = await tx
        .select({
          fixtureId: tournamentFixtures.id,
          fixtureTournamentId: tournamentFixtures.tournamentId,
          tournamentId: tournaments.id,
          clubId: tournaments.clubId,
          tournamentStatus: tournaments.status,
          stage: tournamentFixtures.stage,
          round: tournamentFixtures.round,
          position: tournamentFixtures.position,
          groupId: tournamentFixtures.groupId,
          matchId: matches.id,
          matchSource: matches.source,
          matchStatus: matches.status,
          currentRevision: matches.currentRevision,
          playerOneId: tournamentFixtures.playerOneId,
          playerTwoId: tournamentFixtures.playerTwoId,
          bestOf: matchRuleSnapshots.bestOf,
          pointsToWin: matchRuleSnapshots.pointsToWin,
          winByTwo: matchRuleSnapshots.winByTwo,
        })
        .from(tournamentFixtures)
        .innerJoin(tournaments, eq(tournaments.id, tournamentFixtures.tournamentId))
        .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
        .innerJoin(matchRuleSnapshots, eq(matchRuleSnapshots.id, matches.rulesId))
        .where(eq(tournamentFixtures.id, fixtureId))
        .limit(1)
        .for('update');
      if (!fixture) throw notFound('TOURNAMENT_FIXTURE_NOT_FOUND');
      if (fixture.fixtureTournamentId !== tournamentId) {
        throw invalid('OFFICIAL_RESULT_FIXTURE_MISMATCH');
      }
      if (fixture.matchSource !== 'tournament') {
        throw invalid('OFFICIAL_RESULT_MATCH_INVALID');
      }
      if (fixture.matchStatus === 'completed') {
        throw invalid('OFFICIAL_RESULT_EXISTS');
      }
      if (fixture.currentRevision !== input.expectedRevision) {
        throw invalid('OFFICIAL_RESULT_STALE');
      }
      if (fixture.matchStatus !== 'scheduled') {
        throw invalid('OFFICIAL_RESULT_NOT_RECORDABLE');
      }
      const lifecycleAllowsResult =
        (fixture.stage === 'group' && fixture.tournamentStatus === 'group-stage') ||
        (fixture.stage === 'knockout' && fixture.tournamentStatus === 'knockout');
      if (!lifecycleAllowsResult) throw invalid('OFFICIAL_RESULT_NOT_RECORDABLE');
      if (
        !fixture.matchId ||
        !fixture.playerOneId ||
        !fixture.playerTwoId ||
        (fixture.stage === 'group' && !fixture.groupId)
      ) {
        throw invalid('OFFICIAL_RESULT_FIXTURE_UNAVAILABLE');
      }

      const participants = await tx
        .select({ userId: matchParticipants.userId, position: matchParticipants.position })
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, fixture.matchId))
        .orderBy(matchParticipants.position);
      if (
        participants.length !== 2 ||
        participants[0]?.position !== 1 ||
        participants[0]?.userId !== fixture.playerOneId ||
        participants[1]?.position !== 2 ||
        participants[1]?.userId !== fixture.playerTwoId
      ) {
        throw invalid('OFFICIAL_RESULT_PLAYERS_INVALID');
      }

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
        throw invalid('OFFICIAL_RESULT_INCOMPLETE', 400);
      }
      const winnerId = result.winner === 1 ? fixture.playerOneId : fixture.playerTwoId;
      const completedAt = new Date();
      const revision = input.expectedRevision + 1;
      const [updated] = await tx
        .update(matches)
        .set({
          status: 'completed',
          completedAt,
          submittedById: organizerId,
          winnerId,
          currentRevision: revision,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(matches.id, fixture.matchId),
            eq(matches.status, 'scheduled'),
            eq(matches.currentRevision, input.expectedRevision),
          ),
        )
        .returning({ id: matches.id });
      if (!updated) throw invalid('OFFICIAL_RESULT_CONFLICT');

      await tx.insert(matchSets).values(
        input.games.map((game, index) => ({
          matchId: fixture.matchId,
          setNumber: index + 1,
          ...game,
        })),
      );
      await tx.insert(matchResultRevisions).values({
        matchId: fixture.matchId,
        revision,
        submittedById: organizerId,
        reason: null,
        result: { games: input.games, ...result, winnerId },
      });
      await tx.insert(auditLogs).values({
        actorId: organizerId,
        clubId: fixture.clubId,
        action: 'tournament.official-result-record',
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
          games: input.games,
          winnerId,
          organizerId,
          completedAt: completedAt.toISOString(),
        },
      });
      await tx.insert(outboxEvents).values([
        {
          topic: 'statistics.rebuild',
          aggregateId: fixture.matchId,
          payload: { matchId: fixture.matchId, source: 'tournament' },
        },
        {
          topic: 'tournament.progress',
          aggregateId: fixture.matchId,
          payload: { matchId: fixture.matchId, tournamentId },
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
    },
    { isolationLevel: 'serializable' },
  );
}

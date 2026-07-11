import type {
  TournamentGroupFixture,
  TournamentKnockoutFixture,
  TournamentStatus,
} from '@squash/contracts';
import {
  matches,
  matchRuleSnapshots,
  matchSets,
  tournamentFixtures,
  tournamentGroups,
  users,
} from '@squash/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './database';
import {
  evaluateOfficialResultCorrectionStatus,
  type OfficialResultCorrectionStatus,
} from './official-result-locks';

const groupFixtureReadableStatuses = ['group-stage', 'knockout', 'completed', 'cancelled'] as const;
const knockoutFixtureReadableStatuses = ['knockout', 'completed', 'cancelled'] as const;
const fixturePlayerOne = alias(users, 'fixture_player_one');
const fixturePlayerTwo = alias(users, 'fixture_player_two');

type TournamentFixtureReadInput = {
  id: string;
  rulesId: string;
  status: TournamentStatus;
};

type FixtureScheduleRow = {
  scheduledAt: Date | null;
  venueText: string | null;
  courtLabel: string | null;
};

function serializeFixtureSchedule(row: FixtureScheduleRow) {
  return {
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    venueText: row.venueText,
    courtLabel: row.courtLabel,
  };
}

function serializeGroupFixture(
  row: FixtureScheduleRow & {
    id: string;
    matchId: string;
    matchStatus: 'scheduled' | 'in-progress' | 'completed' | 'disputed' | 'void';
    currentRevision: number;
    winnerId: string | null;
    groupId: string;
    groupName: string;
    groupPosition: number;
    round: number;
    position: number;
    playerOneId: string;
    playerOneName: string;
    playerOneImage: string | null;
    playerTwoId: string;
    playerTwoName: string;
    playerTwoImage: string | null;
    bestOf: number;
    pointsToWin: number;
    winByTwo: boolean;
  },
  games: Array<{ playerOnePoints: number; playerTwoPoints: number }>,
  mayRecord: boolean,
  correctionStatus: OfficialResultCorrectionStatus,
): TournamentGroupFixture {
  return {
    id: row.id,
    matchId: row.matchId,
    stage: 'group',
    matchStatus: row.matchStatus,
    currentRevision: row.currentRevision,
    groupId: row.groupId,
    groupName: row.groupName,
    groupPosition: row.groupPosition,
    round: row.round,
    position: row.position,
    ...serializeFixtureSchedule(row),
    playerOne: { id: row.playerOneId, name: row.playerOneName, image: row.playerOneImage },
    playerTwo: { id: row.playerTwoId, name: row.playerTwoName, image: row.playerTwoImage },
    scoringRules: {
      bestOf: row.bestOf as 1 | 3 | 5,
      pointsToWin: row.pointsToWin,
      winByTwo: row.winByTwo,
    },
    games,
    winnerId: row.winnerId,
    mayRecordInitialOfficialResult: mayRecord,
    officialResultCorrectionStatus: correctionStatus,
  };
}

function serializeKnockoutFixture(
  row: FixtureScheduleRow & {
    id: string;
    matchId: string | null;
    matchStatus: 'scheduled' | 'in-progress' | 'completed' | 'disputed' | 'void' | null;
    currentRevision: number | null;
    winnerId: string | null;
    advancesToFixtureId: string | null;
    round: number;
    position: number;
    playerOneId: string | null;
    playerOneName: string | null;
    playerOneImage: string | null;
    playerTwoId: string | null;
    playerTwoName: string | null;
    playerTwoImage: string | null;
  },
  rules: { bestOf: number; pointsToWin: number; winByTwo: boolean },
  games: Array<{ playerOnePoints: number; playerTwoPoints: number }>,
  mayRecord: boolean,
  mayBeginMatch: boolean,
  correctionStatus: OfficialResultCorrectionStatus,
): TournamentKnockoutFixture {
  return {
    id: row.id,
    matchId: row.matchId,
    stage: 'knockout',
    matchStatus: row.matchStatus,
    currentRevision: row.currentRevision ?? 0,
    round: row.round,
    position: row.position,
    ...serializeFixtureSchedule(row),
    playerOne:
      row.playerOneId && row.playerOneName
        ? { id: row.playerOneId, name: row.playerOneName, image: row.playerOneImage }
        : null,
    playerTwo:
      row.playerTwoId && row.playerTwoName
        ? { id: row.playerTwoId, name: row.playerTwoName, image: row.playerTwoImage }
        : null,
    scoringRules: { ...rules, bestOf: rules.bestOf as 1 | 3 | 5 },
    games,
    winnerId: row.winnerId,
    mayRecordInitialOfficialResult: mayRecord,
    mayBeginMatch,
    officialResultCorrectionStatus: correctionStatus,
  };
}

export async function getTournamentFixtureReadModel(tournament: TournamentFixtureReadInput) {
  const [tournamentRules] = await db
    .select({
      bestOf: matchRuleSnapshots.bestOf,
      pointsToWin: matchRuleSnapshots.pointsToWin,
      winByTwo: matchRuleSnapshots.winByTwo,
    })
    .from(matchRuleSnapshots)
    .where(eq(matchRuleSnapshots.id, tournament.rulesId))
    .limit(1);
  if (!tournamentRules) throw new Error('Tournament Match Scoring Rules could not be loaded.');

  const groupFixtures = groupFixtureReadableStatuses.includes(
    tournament.status as (typeof groupFixtureReadableStatuses)[number],
  )
    ? await db
        .select({
          id: tournamentFixtures.id,
          matchId: matches.id,
          matchStatus: matches.status,
          currentRevision: matches.currentRevision,
          winnerId: matches.winnerId,
          groupId: tournamentGroups.id,
          groupName: tournamentGroups.name,
          groupPosition: tournamentGroups.position,
          round: tournamentFixtures.round,
          position: tournamentFixtures.position,
          scheduledAt: matches.scheduledAt,
          venueText: matches.venueText,
          courtLabel: matches.courtLabel,
          playerOneId: fixturePlayerOne.id,
          playerOneName: fixturePlayerOne.name,
          playerOneImage: fixturePlayerOne.image,
          playerTwoId: fixturePlayerTwo.id,
          playerTwoName: fixturePlayerTwo.name,
          playerTwoImage: fixturePlayerTwo.image,
          bestOf: matchRuleSnapshots.bestOf,
          pointsToWin: matchRuleSnapshots.pointsToWin,
          winByTwo: matchRuleSnapshots.winByTwo,
        })
        .from(tournamentFixtures)
        .innerJoin(tournamentGroups, eq(tournamentGroups.id, tournamentFixtures.groupId))
        .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
        .innerJoin(matchRuleSnapshots, eq(matchRuleSnapshots.id, matches.rulesId))
        .innerJoin(fixturePlayerOne, eq(fixturePlayerOne.id, tournamentFixtures.playerOneId))
        .innerJoin(fixturePlayerTwo, eq(fixturePlayerTwo.id, tournamentFixtures.playerTwoId))
        .where(
          and(
            eq(tournamentFixtures.tournamentId, tournament.id),
            eq(tournamentFixtures.stage, 'group'),
          ),
        )
        .orderBy(
          asc(tournamentGroups.position),
          asc(tournamentFixtures.round),
          asc(tournamentFixtures.position),
        )
    : [];
  const orderedGroupFixtures = [...groupFixtures].sort(
    (left, right) =>
      left.groupPosition - right.groupPosition ||
      left.round - right.round ||
      left.position - right.position,
  );

  const knockoutFixtures = knockoutFixtureReadableStatuses.includes(
    tournament.status as (typeof knockoutFixtureReadableStatuses)[number],
  )
    ? await db
        .select({
          id: tournamentFixtures.id,
          matchId: tournamentFixtures.matchId,
          matchStatus: matches.status,
          currentRevision: matches.currentRevision,
          winnerId: matches.winnerId,
          advancesToFixtureId: tournamentFixtures.advancesToFixtureId,
          round: tournamentFixtures.round,
          position: tournamentFixtures.position,
          scheduledAt: matches.scheduledAt,
          venueText: matches.venueText,
          courtLabel: matches.courtLabel,
          playerOneId: fixturePlayerOne.id,
          playerOneName: fixturePlayerOne.name,
          playerOneImage: fixturePlayerOne.image,
          playerTwoId: fixturePlayerTwo.id,
          playerTwoName: fixturePlayerTwo.name,
          playerTwoImage: fixturePlayerTwo.image,
        })
        .from(tournamentFixtures)
        .leftJoin(matches, eq(matches.id, tournamentFixtures.matchId))
        .leftJoin(fixturePlayerOne, eq(fixturePlayerOne.id, tournamentFixtures.playerOneId))
        .leftJoin(fixturePlayerTwo, eq(fixturePlayerTwo.id, tournamentFixtures.playerTwoId))
        .where(
          and(
            eq(tournamentFixtures.tournamentId, tournament.id),
            eq(tournamentFixtures.stage, 'knockout'),
          ),
        )
        .orderBy(asc(tournamentFixtures.round), asc(tournamentFixtures.position))
    : [];

  const matchIds = [...orderedGroupFixtures, ...knockoutFixtures]
    .map((fixture) => fixture.matchId)
    .filter((matchId): matchId is string => Boolean(matchId));
  const gameRows =
    matchIds.length > 0
      ? await db
          .select({
            matchId: matchSets.matchId,
            playerOnePoints: matchSets.playerOnePoints,
            playerTwoPoints: matchSets.playerTwoPoints,
          })
          .from(matchSets)
          .where(inArray(matchSets.matchId, matchIds))
          .orderBy(asc(matchSets.matchId), asc(matchSets.setNumber))
      : [];
  const gamesByMatchId = new Map<
    string,
    Array<{ playerOnePoints: number; playerTwoPoints: number }>
  >();
  for (const { matchId, playerOnePoints, playerTwoPoints } of gameRows) {
    const games = gamesByMatchId.get(matchId) ?? [];
    games.push({ playerOnePoints, playerTwoPoints });
    gamesByMatchId.set(matchId, games);
  }
  const gamesFor = (matchId: string | null) => (matchId ? (gamesByMatchId.get(matchId) ?? []) : []);
  const knockoutFixtureById = new Map(knockoutFixtures.map((fixture) => [fixture.id, fixture]));

  return {
    groupFixtures: orderedGroupFixtures.map((fixture) =>
      serializeGroupFixture(
        fixture,
        gamesFor(fixture.matchId),
        tournament.status === 'group-stage' &&
          fixture.matchStatus === 'scheduled' &&
          fixture.currentRevision === 0,
        evaluateOfficialResultCorrectionStatus({
          stage: 'group',
          tournamentStatus: tournament.status,
        }),
      ),
    ),
    knockoutFixtures: knockoutFixtures.map((fixture) =>
      serializeKnockoutFixture(
        fixture,
        tournamentRules,
        gamesFor(fixture.matchId),
        tournament.status === 'knockout' &&
          fixture.matchStatus === 'in-progress' &&
          fixture.currentRevision === 0 &&
          Boolean(fixture.matchId && fixture.playerOneId && fixture.playerTwoId),
        tournament.status === 'knockout' &&
          fixture.matchStatus === 'scheduled' &&
          fixture.currentRevision === 0 &&
          Boolean(fixture.matchId && fixture.playerOneId && fixture.playerTwoId),
        evaluateOfficialResultCorrectionStatus({
          stage: 'knockout',
          tournamentStatus: tournament.status,
          dependentMatchStatus: fixture.advancesToFixtureId
            ? (knockoutFixtureById.get(fixture.advancesToFixtureId)?.matchStatus ?? null)
            : null,
        }),
      ),
    ),
  };
}

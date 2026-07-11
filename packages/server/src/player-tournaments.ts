import type { TournamentPlayerDetail } from '@squash/contracts';
import { tournamentPlayerDetailSchema } from '@squash/contracts';
import {
  clubMemberships,
  clubs,
  matchRuleSnapshots,
  tournamentGroupMembers,
  tournamentGroups,
  tournamentParticipations,
  tournaments,
  users,
} from '@squash/db/schema';
import {
  calculateGameStandings,
  canViewOfficialTournamentForPlayer,
  isOfficialTournamentChampionValid,
  OrganizerTiebreakRequiredError,
  type GameStanding,
  type GroupGameMatch,
} from '@squash/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import { requireRegisteredPlayer } from './authorization';
import { db } from './database';
import { forbidden, notFound } from './errors';
import { getTournamentFixtureReadModel } from './tournament-fixture-read-model';

type PlayerIdentity = { id: string; name: string; image: string | null };
type GroupMemberRow = PlayerIdentity & {
  groupId: string;
  groupName: string;
  groupPosition: number;
  seed: number | null;
  finalRank: number | null;
};

function completedGroupMatches(
  fixtures: Awaited<ReturnType<typeof getTournamentFixtureReadModel>>['groupFixtures'],
): GroupGameMatch[] {
  return fixtures
    .filter((fixture) => fixture.matchStatus === 'completed')
    .map((fixture) => ({
      playerOneId: fixture.playerOne.id,
      playerTwoId: fixture.playerTwo.id,
      playerOneGames: fixture.games.filter((game) => game.playerOnePoints > game.playerTwoPoints)
        .length,
      playerTwoGames: fixture.games.filter((game) => game.playerTwoPoints > game.playerOnePoints)
        .length,
      playerOnePoints: fixture.games.reduce((total, game) => total + game.playerOnePoints, 0),
      playerTwoPoints: fixture.games.reduce((total, game) => total + game.playerTwoPoints, 0),
    }));
}

function currentStandings(members: GroupMemberRow[], matches: GroupGameMatch[]) {
  const finalOrder = members
    .filter((member) => member.finalRank !== null)
    .sort((left, right) => (left.finalRank ?? 0) - (right.finalRank ?? 0))
    .map((member) => member.id);
  let organizerTiebreakOrder = finalOrder;
  const unresolvedTies: string[][] = [];
  let standings: GameStanding[];

  for (;;) {
    try {
      standings = calculateGameStandings(
        members.map((member) => member.id),
        matches,
        organizerTiebreakOrder.length > 0 ? { organizerTiebreakOrder } : {},
      );
      break;
    } catch (error) {
      if (!(error instanceof OrganizerTiebreakRequiredError)) throw error;
      unresolvedTies.push([...error.playerIds]);
      organizerTiebreakOrder = [
        ...organizerTiebreakOrder,
        ...error.playerIds.filter((playerId) => !organizerTiebreakOrder.includes(playerId)),
      ];
    }
  }

  const playerById = new Map(members.map((member) => [member.id, member]));
  const tiedRankByPlayer = new Map<string, number>();
  for (const tiedPlayers of unresolvedTies) {
    const ranks = standings
      .filter((standing) => tiedPlayers.includes(standing.playerId))
      .map((standing) => standing.rank);
    const sharedRank = Math.min(...ranks);
    for (const playerId of tiedPlayers) tiedRankByPlayer.set(playerId, sharedRank);
  }

  return standings
    .map((standing) => {
      const player = playerById.get(standing.playerId);
      if (!player) throw new Error('A Group standing references an unknown Player.');
      return {
        rank: tiedRankByPlayer.get(standing.playerId) ?? standing.rank,
        tied: tiedRankByPlayer.has(standing.playerId),
        player: { id: player.id, name: player.name, image: player.image },
        played: standing.played,
        wins: standing.wins,
        losses: standing.losses,
        gamesWon: standing.gamesWon,
        gamesLost: standing.gamesLost,
        gameDifferential: standing.gameDifferential,
        pointsFor: standing.pointsFor,
        pointsAgainst: standing.pointsAgainst,
        pointDifferential: standing.pointDifferential,
      };
    })
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.player.name.localeCompare(right.player.name, undefined, { sensitivity: 'base' }),
    );
}

function toPlayerFixture(fixture: {
  id: string;
  matchId: string | null;
  matchStatus: 'scheduled' | 'in-progress' | 'completed' | 'disputed' | 'void' | null;
  round: number;
  position: number;
  scheduledAt?: string | null | undefined;
  venueText?: string | null | undefined;
  courtLabel?: string | null | undefined;
  playerOne: PlayerIdentity | null;
  playerTwo: PlayerIdentity | null;
  games: Array<{ playerOnePoints: number; playerTwoPoints: number }>;
  winnerId: string | null;
}) {
  return {
    id: fixture.id,
    matchId: fixture.matchId,
    status: fixture.matchStatus,
    round: fixture.round,
    position: fixture.position,
    scheduledAt: fixture.scheduledAt ?? null,
    venueText: fixture.venueText ?? null,
    courtLabel: fixture.courtLabel ?? null,
    playerOne: fixture.playerOne,
    playerTwo: fixture.playerTwo,
    games: fixture.games,
    winnerId: fixture.winnerId,
  };
}

export async function getOfficialTournamentPlayerDetail(
  actorId: string,
  tournamentId: string,
): Promise<TournamentPlayerDetail> {
  await requireRegisteredPlayer(actorId);
  const [tournament] = await db
    .select({
      id: tournaments.id,
      clubId: tournaments.clubId,
      clubName: clubs.name,
      name: tournaments.name,
      description: tournaments.description,
      venue: tournaments.venue,
      visibility: tournaments.visibility,
      status: tournaments.status,
      startsAt: tournaments.startsAt,
      timeZone: tournaments.timeZone,
      groupSize: tournaments.groupSize,
      qualifiersPerGroup: tournaments.qualifiersPerGroup,
      wildcardQualifiers: tournaments.wildcardQualifiers,
      seedingMethod: tournaments.seedingMethod,
      rulesId: tournaments.rulesId,
      bestOf: matchRuleSnapshots.bestOf,
      pointsToWin: matchRuleSnapshots.pointsToWin,
      winByTwo: matchRuleSnapshots.winByTwo,
      hasActiveMembership: sql<boolean>`exists (
        select 1 from ${clubMemberships}
        where ${clubMemberships.clubId} = ${tournaments.clubId}
          and ${clubMemberships.userId} = ${actorId}
          and ${clubMemberships.status} = 'active'
      )`,
      hasParticipation: sql<boolean>`exists (
        select 1 from ${tournamentParticipations}
        where ${tournamentParticipations.tournamentId} = ${tournaments.id}
          and ${tournamentParticipations.playerId} = ${actorId}
      )`,
    })
    .from(tournaments)
    .innerJoin(clubs, eq(clubs.id, tournaments.clubId))
    .innerJoin(matchRuleSnapshots, eq(matchRuleSnapshots.id, tournaments.rulesId))
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament || tournament.status === 'draft') throw notFound('TOURNAMENT_NOT_FOUND');
  if (
    !canViewOfficialTournamentForPlayer({
      status: tournament.status,
      visibility: tournament.visibility,
      hasActiveOwningClubMembership: tournament.hasActiveMembership,
      relationship: tournament.hasParticipation ? 'accepted' : 'none',
    })
  ) {
    throw forbidden();
  }

  const memberRows = await db
    .select({
      groupId: tournamentGroups.id,
      groupName: tournamentGroups.name,
      groupPosition: tournamentGroups.position,
      id: users.id,
      name: users.name,
      image: users.image,
      seed: tournamentGroupMembers.seed,
      finalRank: tournamentGroupMembers.finalRank,
    })
    .from(tournamentGroups)
    .innerJoin(tournamentGroupMembers, eq(tournamentGroupMembers.groupId, tournamentGroups.id))
    .innerJoin(users, eq(users.id, tournamentGroupMembers.userId))
    .where(eq(tournamentGroups.tournamentId, tournament.id))
    .orderBy(asc(tournamentGroups.position), asc(tournamentGroupMembers.seed), asc(users.name));
  const fixtureReadModel = await getTournamentFixtureReadModel(tournament);
  const membersByGroup = new Map<string, GroupMemberRow[]>();
  for (const member of memberRows) {
    membersByGroup.set(member.groupId, [...(membersByGroup.get(member.groupId) ?? []), member]);
  }
  const mayExposeGroups =
    tournament.status !== 'registration' &&
    (tournament.status !== 'cancelled' || fixtureReadModel.groupFixtures.length > 0);
  const groups = (mayExposeGroups ? [...membersByGroup.values()] : []).map((members) => {
    const first = members[0];
    if (!first) throw new Error('A Tournament Group cannot be empty.');
    const fixtures = fixtureReadModel.groupFixtures.filter(
      (fixture) => fixture.groupId === first.groupId,
    );
    return {
      id: first.groupId,
      name: first.groupName,
      position: first.groupPosition,
      assignments: members.map(({ id, name, image }) => ({ id, name, image })),
      standings: currentStandings(members, completedGroupMatches(fixtures)),
      fixtures: fixtures.map(toPlayerFixture),
    };
  });
  const knockoutDraw = fixtureReadModel.knockoutFixtures.map(toPlayerFixture);
  const playerById = new Map<string, PlayerIdentity>();
  for (const fixture of [...fixtureReadModel.groupFixtures, ...fixtureReadModel.knockoutFixtures]) {
    if (fixture.playerOne) playerById.set(fixture.playerOne.id, fixture.playerOne);
    if (fixture.playerTwo) playerById.set(fixture.playerTwo.id, fixture.playerTwo);
  }
  const finalFixture = [...fixtureReadModel.knockoutFixtures].sort(
    (left, right) => right.round - left.round,
  )[0];
  const champion =
    tournament.status === 'completed' && finalFixture?.winnerId
      ? (playerById.get(finalFixture.winnerId) ?? null)
      : null;
  if (!isOfficialTournamentChampionValid(tournament.status, champion?.id ?? null)) {
    throw new Error('Official Tournament champion state is invalid.');
  }

  return tournamentPlayerDetailSchema.parse({
    id: tournament.id,
    club: { id: tournament.clubId, name: tournament.clubName },
    name: tournament.name,
    description: tournament.description,
    venue: tournament.venue,
    visibility: tournament.visibility,
    status: tournament.status,
    startsAt: tournament.startsAt.toISOString(),
    timeZone: tournament.timeZone,
    configuration: {
      groupSize: tournament.groupSize,
      automaticQualifiersPerGroup: tournament.qualifiersPerGroup,
      wildcardQualifiers: tournament.wildcardQualifiers,
      seedingMethod: tournament.seedingMethod,
      scoringRules: {
        bestOf: tournament.bestOf,
        pointsToWin: tournament.pointsToWin,
        winByTwo: tournament.winByTwo,
      },
    },
    groups,
    knockoutDraw,
    champion,
  });
}

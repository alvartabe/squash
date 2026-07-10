import { createHash } from 'node:crypto';
import {
  matchParticipants,
  matches,
  matchSets,
  organizerTiebreakDecisions,
  tournamentAdvancements,
  tournamentFixtures,
  tournamentGroupMembers,
  tournamentGroups,
  tournaments,
} from '@squash/db/schema';
import {
  calculateStandings,
  createFirstRound,
  isExactOrganizerTiebreakOrder,
  nextPowerOfTwo,
  OrganizerTiebreakRequiredError,
  selectTournamentQualifiers,
  type GroupMatch,
  type Qualifier,
} from '@squash/domain';
import { and, eq } from 'drizzle-orm';
import { db } from './database';

type GroupQualifiersResult =
  | { status: 'pending' }
  | { status: 'manual-tiebreak-required'; requirement: TournamentProgressionRequirement }
  | {
      status: 'ready';
      qualifiers: Qualifier[];
      groupStandings: Array<{
        groupId: string;
        standings: ReturnType<typeof calculateStandings>;
      }>;
      organizerSeedingOrder?: readonly string[];
    };

type ProgressionReadDatabase = Pick<typeof db, 'select'>;

export type TournamentProgressionRequirement = {
  tournamentId: string;
  context: 'group-standings' | 'wildcard-cutoff' | 'knockout-seeding';
  groupId: string | null;
  playerIds: readonly string[];
  requirementKey: string;
};

function progressionRequirement(input: {
  tournamentId: string;
  context: TournamentProgressionRequirement['context'];
  groupId: string | null;
  playerIds: readonly string[];
  snapshot: unknown;
}): TournamentProgressionRequirement {
  const requirementKey = createHash('sha256')
    .update(
      JSON.stringify({
        tournamentId: input.tournamentId,
        context: input.context,
        groupId: input.groupId,
        playerIds: [...input.playerIds].sort(),
        snapshot: input.snapshot,
      }),
    )
    .digest('hex');
  return {
    tournamentId: input.tournamentId,
    context: input.context,
    groupId: input.groupId,
    playerIds: input.playerIds,
    requirementKey,
  };
}

async function decisionOrderFor(
  requirement: TournamentProgressionRequirement,
  database: ProgressionReadDatabase,
) {
  const [decision] = await database
    .select({
      context: organizerTiebreakDecisions.context,
      groupId: organizerTiebreakDecisions.groupId,
      orderedPlayerIds: organizerTiebreakDecisions.orderedPlayerIds,
    })
    .from(organizerTiebreakDecisions)
    .where(
      and(
        eq(organizerTiebreakDecisions.tournamentId, requirement.tournamentId),
        eq(organizerTiebreakDecisions.requirementKey, requirement.requirementKey),
      ),
    )
    .limit(1);
  if (
    !decision ||
    decision.context !== requirement.context ||
    decision.groupId !== requirement.groupId ||
    !isExactOrganizerTiebreakOrder(requirement.playerIds, decision.orderedPlayerIds)
  ) {
    return null;
  }
  return decision.orderedPlayerIds;
}

function appendTiebreakOrder(current: readonly string[], additional: readonly string[]) {
  const existing = new Set(current);
  return [...current, ...additional.filter((playerId) => !existing.has(playerId))];
}

async function groupQualifiers(input: {
  tournamentId: string;
  qualifiersPerGroup: number;
  wildcardQualifiers: number;
  database: ProgressionReadDatabase;
}): Promise<GroupQualifiersResult> {
  const groups = await input.database
    .select()
    .from(tournamentGroups)
    .where(eq(tournamentGroups.tournamentId, input.tournamentId));
  const orderedGroups = [...groups].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id),
  );
  const groupStandings: Array<{
    groupId: string;
    standings: ReturnType<typeof calculateStandings>;
  }> = [];
  const tournamentSnapshot: Array<{
    groupId: string;
    matchId: string | null;
    revision: number;
    status: string;
  }> = [];
  for (const group of orderedGroups) {
    const members = await input.database
      .select({ userId: tournamentGroupMembers.userId })
      .from(tournamentGroupMembers)
      .where(eq(tournamentGroupMembers.groupId, group.id));
    const fixtures = await input.database
      .select({
        matchId: tournamentFixtures.matchId,
        playerOneId: tournamentFixtures.playerOneId,
        playerTwoId: tournamentFixtures.playerTwoId,
        status: matches.status,
        revision: matches.currentRevision,
      })
      .from(tournamentFixtures)
      .innerJoin(matches, eq(matches.id, tournamentFixtures.matchId))
      .where(and(eq(tournamentFixtures.groupId, group.id), eq(tournamentFixtures.stage, 'group')));
    if (fixtures.some((fixture) => fixture.status !== 'completed')) return { status: 'pending' };
    tournamentSnapshot.push(
      ...fixtures.map((fixture) => ({
        groupId: group.id,
        matchId: fixture.matchId,
        revision: fixture.revision,
        status: fixture.status,
      })),
    );
    const groupMatches: GroupMatch[] = [];
    for (const fixture of fixtures) {
      if (!fixture.matchId || !fixture.playerOneId || !fixture.playerTwoId) continue;
      const sets = await input.database
        .select()
        .from(matchSets)
        .where(eq(matchSets.matchId, fixture.matchId));
      groupMatches.push({
        playerOneId: fixture.playerOneId,
        playerTwoId: fixture.playerTwoId,
        playerOneSets: sets.filter((set) => set.playerOnePoints > set.playerTwoPoints).length,
        playerTwoSets: sets.filter((set) => set.playerTwoPoints > set.playerOnePoints).length,
        playerOnePoints: sets.reduce((total, set) => total + set.playerOnePoints, 0),
        playerTwoPoints: sets.reduce((total, set) => total + set.playerTwoPoints, 0),
      });
    }
    let standings: ReturnType<typeof calculateStandings> | null = null;
    let organizerTiebreakOrder: readonly string[] = [];
    while (!standings) {
      try {
        standings = calculateStandings(
          members.map((member) => member.userId),
          groupMatches,
          organizerTiebreakOrder.length > 0 ? { organizerTiebreakOrder } : {},
        );
      } catch (error) {
        if (!(error instanceof OrganizerTiebreakRequiredError)) throw error;
        const requirement = progressionRequirement({
          tournamentId: input.tournamentId,
          context: error.context,
          groupId: group.id,
          playerIds: error.playerIds,
          snapshot: fixtures
            .map((fixture) => ({
              matchId: fixture.matchId,
              revision: fixture.revision,
              status: fixture.status,
            }))
            .sort((left, right) => (left.matchId ?? '').localeCompare(right.matchId ?? '')),
        });
        const recordedOrder = await decisionOrderFor(requirement, input.database);
        if (!recordedOrder) {
          return { status: 'manual-tiebreak-required', requirement };
        }
        organizerTiebreakOrder = appendTiebreakOrder(organizerTiebreakOrder, recordedOrder);
      }
    }
    groupStandings.push({ groupId: group.id, standings });
  }
  const organizerTiebreakOrders: Partial<
    Record<'wildcard-cutoff' | 'knockout-seeding', readonly string[]>
  > = {};
  for (;;) {
    try {
      const qualifiers = selectTournamentQualifiers(groupStandings, {
        automaticQualifiersPerGroup: input.qualifiersPerGroup,
        wildcardQualifiers: input.wildcardQualifiers,
        organizerTiebreakOrders,
      });
      return {
        status: 'ready',
        qualifiers,
        groupStandings,
        ...(organizerTiebreakOrders['knockout-seeding']
          ? { organizerSeedingOrder: organizerTiebreakOrders['knockout-seeding'] }
          : {}),
      };
    } catch (error) {
      if (!(error instanceof OrganizerTiebreakRequiredError)) throw error;
      if (error.context === 'group-standings') throw error;
      const requirement = progressionRequirement({
        tournamentId: input.tournamentId,
        context: error.context,
        groupId: null,
        playerIds: error.playerIds,
        snapshot: {
          groupStandings: groupStandings.map((group) => ({
            groupId: group.groupId,
            standings: [...group.standings].sort((left, right) =>
              left.playerId.localeCompare(right.playerId),
            ),
          })),
          tournamentSnapshot: [...tournamentSnapshot].sort(
            (left, right) =>
              left.groupId.localeCompare(right.groupId) ||
              (left.matchId ?? '').localeCompare(right.matchId ?? ''),
          ),
        },
      });
      const organizerTiebreakOrder = await decisionOrderFor(requirement, input.database);
      if (!organizerTiebreakOrder) {
        return { status: 'manual-tiebreak-required', requirement };
      }
      organizerTiebreakOrders[error.context] = appendTiebreakOrder(
        organizerTiebreakOrders[error.context] ?? [],
        organizerTiebreakOrder,
      );
    }
  }
}

export async function inspectTournamentProgression(
  tournamentId: string,
  database: ProgressionReadDatabase = db,
) {
  const [tournament] = await database
    .select({
      id: tournaments.id,
      status: tournaments.status,
      qualifiersPerGroup: tournaments.qualifiersPerGroup,
      wildcardQualifiers: tournaments.wildcardQualifiers,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament || tournament.status !== 'group-stage') {
    return { status: 'inactive' as const };
  }
  return groupQualifiers({
    tournamentId,
    qualifiersPerGroup: tournament.qualifiersPerGroup,
    wildcardQualifiers: tournament.wildcardQualifiers ?? 0,
    database,
  });
}

export async function progressTournament(tournamentId: string) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament || tournament.status !== 'group-stage') return { progressed: false };
  const qualifierResult = await groupQualifiers({
    tournamentId,
    qualifiersPerGroup: tournament.qualifiersPerGroup,
    wildcardQualifiers: tournament.wildcardQualifiers ?? 0,
    database: db,
  });
  if (qualifierResult.status !== 'ready') {
    return qualifierResult.status === 'manual-tiebreak-required'
      ? {
          progressed: false,
          reason: qualifierResult.status,
          requirement: qualifierResult.requirement,
        }
      : { progressed: false, reason: qualifierResult.status };
  }
  if (qualifierResult.qualifiers.length < 2) {
    return { progressed: false, reason: 'not-enough-qualifiers' };
  }
  const seeded = qualifierResult.qualifiers;
  const firstRound = createFirstRound(
    seeded,
    qualifierResult.organizerSeedingOrder
      ? { organizerTiebreakOrder: qualifierResult.organizerSeedingOrder }
      : {},
  );
  const bracketSize = nextPowerOfTwo(seeded.length);
  const totalRounds = Math.log2(bracketSize);

  await db.transaction(async (tx) => {
    for (const group of qualifierResult.groupStandings) {
      for (const standing of group.standings) {
        await tx
          .update(tournamentGroupMembers)
          .set({ finalRank: standing.rank })
          .where(
            and(
              eq(tournamentGroupMembers.groupId, group.groupId),
              eq(tournamentGroupMembers.userId, standing.playerId),
            ),
          );
      }
    }
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
    const createKnockoutMatchForFixture = async (fixture: {
      id: string;
      playerOneId: string | null;
      playerTwoId: string | null;
    }) => {
      if (!fixture.playerOneId || !fixture.playerTwoId) return;
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
        { matchId: match.id, userId: fixture.playerOneId, position: 1 },
        { matchId: match.id, userId: fixture.playerTwoId, position: 2 },
      ]);
      await tx
        .update(tournamentFixtures)
        .set({ matchId: match.id })
        .where(eq(tournamentFixtures.id, fixture.id));
    };
    for (const fixture of rounds.get(1) ?? []) {
      const opening = firstRound.find((item) => item.position === fixture.position);
      if (!opening) continue;
      if (opening.playerOneId && opening.playerTwoId) {
        await createKnockoutMatchForFixture({
          id: fixture.id,
          playerOneId: opening.playerOneId,
          playerTwoId: opening.playerTwoId,
        });
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
          const [targetFixture] = await tx
            .select({
              id: tournamentFixtures.id,
              matchId: tournamentFixtures.matchId,
              playerOneId: tournamentFixtures.playerOneId,
              playerTwoId: tournamentFixtures.playerTwoId,
            })
            .from(tournamentFixtures)
            .where(eq(tournamentFixtures.id, target.id))
            .limit(1);
          if (targetFixture && !targetFixture.matchId) {
            await createKnockoutMatchForFixture(targetFixture);
          }
        }
      }
    }
    await tx
      .update(tournaments)
      .set({ status: 'knockout', updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
  });
  return { progressed: true, qualifiers: seeded.length, rounds: totalRounds };
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

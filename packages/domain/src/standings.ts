import type { GroupMatch, Standing } from './types';

type MutableStanding = Omit<
  Standing,
  | 'rank'
  | 'setDifferential'
  | 'pointDifferential'
  | 'matchWinPercentage'
  | 'gameWinPercentage'
  | 'pointWinPercentage'
>;

type StandingMetric = 'wins' | 'setsWon' | 'setDifferential' | 'pointDifferential';

export type OrganizerTiebreakContext = 'group-standings' | 'wildcard-cutoff' | 'knockout-seeding';

export class OrganizerTiebreakRequiredError extends Error {
  constructor(
    message: string,
    readonly playerIds: readonly string[],
    readonly context: OrganizerTiebreakContext = 'group-standings',
  ) {
    super(message);
    this.name = 'OrganizerTiebreakRequiredError';
  }
}

export function isExactOrganizerTiebreakOrder(
  requiredPlayerIds: readonly string[],
  orderedPlayerIds: readonly string[],
) {
  if (requiredPlayerIds.length !== orderedPlayerIds.length) return false;
  if (new Set(orderedPlayerIds).size !== orderedPlayerIds.length) return false;
  const required = new Set(requiredPlayerIds);
  return orderedPlayerIds.every((playerId) => required.has(playerId));
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function emptyStanding(playerId: string): MutableStanding {
  return {
    playerId,
    played: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function completeStanding(row: MutableStanding): Standing {
  const setDifferential = row.setsWon - row.setsLost;
  const pointDifferential = row.pointsFor - row.pointsAgainst;
  return {
    ...row,
    setDifferential,
    pointDifferential,
    matchWinPercentage: ratio(row.wins, row.played),
    gameWinPercentage: ratio(row.setsWon, row.setsWon + row.setsLost),
    pointWinPercentage: ratio(row.pointsFor, row.pointsFor + row.pointsAgainst),
    rank: 0,
  };
}

function recordMatch(table: Map<string, MutableStanding>, match: GroupMatch) {
  const one = table.get(match.playerOneId);
  const two = table.get(match.playerTwoId);
  if (!one || !two) throw new Error('A group match contains a player outside the group.');
  if (match.playerOneSets === match.playerTwoSets) {
    throw new Error('A completed group match cannot be tied.');
  }

  one.played += 1;
  two.played += 1;
  one.setsWon += match.playerOneSets;
  one.setsLost += match.playerTwoSets;
  two.setsWon += match.playerTwoSets;
  two.setsLost += match.playerOneSets;
  one.pointsFor += match.playerOnePoints;
  one.pointsAgainst += match.playerTwoPoints;
  two.pointsFor += match.playerTwoPoints;
  two.pointsAgainst += match.playerOnePoints;
  if (match.playerOneSets > match.playerTwoSets) {
    one.wins += 1;
    two.losses += 1;
  } else {
    two.wins += 1;
    one.losses += 1;
  }
}

function headToHeadWinner(a: string, b: string, matches: readonly GroupMatch[]): string | null {
  const match = matches.find(
    (item) =>
      (item.playerOneId === a && item.playerTwoId === b) ||
      (item.playerOneId === b && item.playerTwoId === a),
  );
  if (!match || match.playerOneSets === match.playerTwoSets) return null;
  return match.playerOneSets > match.playerTwoSets ? match.playerOneId : match.playerTwoId;
}

function matchesAmong(playerIds: readonly string[], matches: readonly GroupMatch[]) {
  const playerSet = new Set(playerIds);
  return matches.filter(
    (match) => playerSet.has(match.playerOneId) && playerSet.has(match.playerTwoId),
  );
}

function summarizePlayers(playerIds: readonly string[], matches: readonly GroupMatch[]) {
  const table = new Map(playerIds.map((playerId) => [playerId, emptyStanding(playerId)]));
  for (const match of matches) recordMatch(table, match);
  return new Map([...table.values()].map((row) => [row.playerId, completeStanding(row)]));
}

function metricValue(playerId: string, metric: StandingMetric, standings: Map<string, Standing>) {
  const standing = standings.get(playerId);
  if (!standing) throw new Error('Missing standing for tied player.');
  return standing[metric];
}

function splitByMetric(
  playerIds: readonly string[],
  metric: StandingMetric,
  matches: readonly GroupMatch[],
) {
  const subsetStandings = summarizePlayers(playerIds, matchesAmong(playerIds, matches));
  const buckets = new Map<number, string[]>();
  for (const playerId of playerIds) {
    const value = metricValue(playerId, metric, subsetStandings);
    buckets.set(value, [...(buckets.get(value) ?? []), playerId]);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => right - left)
    .map(([, players]) => players);
}

function manualOrder(
  playerIds: readonly string[],
  organizerTiebreakOrder: readonly string[] | undefined,
) {
  if (!organizerTiebreakOrder) return null;
  const positions = new Map(organizerTiebreakOrder.map((playerId, index) => [playerId, index]));
  if (playerIds.some((playerId) => !positions.has(playerId))) return null;
  return [...playerIds].sort(
    (left, right) => (positions.get(left) ?? 0) - (positions.get(right) ?? 0),
  );
}

function resolveTwoPlayerTie(
  playerIds: readonly [string, string],
  matches: readonly GroupMatch[],
  organizerTiebreakOrder: readonly string[] | undefined,
) {
  const winner = headToHeadWinner(playerIds[0], playerIds[1], matches);
  if (winner) {
    return winner === playerIds[0] ? [playerIds[0], playerIds[1]] : [playerIds[1], playerIds[0]];
  }
  const ordered = manualOrder(playerIds, organizerTiebreakOrder);
  if (ordered) return ordered;
  throw new OrganizerTiebreakRequiredError(
    'An Organizer Tiebreak Decision is required.',
    playerIds,
    'group-standings',
  );
}

function resolveHeadToHeadPartitions(
  partitions: readonly string[][],
  matches: readonly GroupMatch[],
  organizerTiebreakOrder: readonly string[] | undefined,
) {
  return partitions.flatMap((partition) => {
    if (partition.length !== 2) return [partition];
    return resolveTwoPlayerTie(
      [partition[0] as string, partition[1] as string],
      matches,
      organizerTiebreakOrder,
    ).map((playerId) => [playerId]);
  });
}

function orderTiedPlayers(
  playerIds: readonly string[],
  matches: readonly GroupMatch[],
  organizerTiebreakOrder: readonly string[] | undefined,
) {
  if (playerIds.length === 2) {
    return resolveTwoPlayerTie(
      [playerIds[0] as string, playerIds[1] as string],
      matches,
      organizerTiebreakOrder,
    );
  }

  let partitions = [Array.from(playerIds)];
  const metrics: StandingMetric[] = ['wins', 'setsWon', 'setDifferential', 'pointDifferential'];
  for (const metric of metrics) {
    partitions = partitions.flatMap((partition) =>
      partition.length >= 3 ? splitByMetric(partition, metric, matches) : [partition],
    );
    partitions = resolveHeadToHeadPartitions(partitions, matches, organizerTiebreakOrder);
  }

  partitions = partitions.map((partition) => {
    if (partition.length <= 1) return partition;
    const ordered = manualOrder(partition, organizerTiebreakOrder);
    if (!ordered) {
      throw new OrganizerTiebreakRequiredError(
        'An Organizer Tiebreak Decision is required.',
        partition,
        'group-standings',
      );
    }
    return ordered;
  });

  return partitions.flat();
}

export function calculateStandings(
  playerIds: readonly string[],
  matches: readonly GroupMatch[],
  options: { organizerTiebreakOrder?: readonly string[] } = {},
): Standing[] {
  const table = new Map(playerIds.map((playerId) => [playerId, emptyStanding(playerId)]));
  for (const match of matches) recordMatch(table, match);

  const rowsByPlayer = new Map(
    [...table.values()].map((row) => [row.playerId, completeStanding(row)]),
  );
  const winBuckets = new Map<number, string[]>();
  for (const playerId of playerIds) {
    const wins = rowsByPlayer.get(playerId)?.wins;
    if (wins === undefined) throw new Error('Missing standing for player.');
    winBuckets.set(wins, [...(winBuckets.get(wins) ?? []), playerId]);
  }

  const orderedPlayerIds = [...winBuckets.entries()]
    .sort(([left], [right]) => right - left)
    .flatMap(([, tiedPlayerIds]) =>
      tiedPlayerIds.length === 1
        ? tiedPlayerIds
        : orderTiedPlayers(tiedPlayerIds, matches, options.organizerTiebreakOrder),
    );

  return orderedPlayerIds.map((playerId, index) => {
    const row = rowsByPlayer.get(playerId);
    if (!row) throw new Error('Missing standing for player.');
    return { ...row, rank: index + 1 };
  });
}

import { OrganizerTiebreakRequiredError } from './standings';
import type { FirstRoundFixture, Qualifier, Standing } from './types';

export type GroupStandings = {
  groupId: string;
  standings: readonly Standing[];
};

export function nextPowerOfTwo(value: number): number {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error('A bracket needs at least two qualifiers.');
  }
  return 2 ** Math.ceil(Math.log2(value));
}

function qualifierFromStanding(
  groupId: string,
  standing: Standing,
  qualification: Qualifier['qualification'],
): Qualifier {
  return {
    playerId: standing.playerId,
    groupId,
    groupRank: standing.rank,
    qualification,
    wins: standing.wins,
    matchesPlayed: standing.played,
    setsWon: standing.setsWon,
    setsLost: standing.setsLost,
    setDifferential: standing.setDifferential,
    pointsFor: standing.pointsFor,
    pointsAgainst: standing.pointsAgainst,
    pointDifferential: standing.pointDifferential,
    matchWinPercentage: standing.matchWinPercentage,
    gameWinPercentage: standing.gameWinPercentage,
    pointWinPercentage: standing.pointWinPercentage,
  };
}

function wildcardComparison(a: Qualifier, b: Qualifier): number {
  if (a.matchWinPercentage !== b.matchWinPercentage) {
    return b.matchWinPercentage - a.matchWinPercentage;
  }
  if (a.gameWinPercentage !== b.gameWinPercentage) {
    return b.gameWinPercentage - a.gameWinPercentage;
  }
  if (a.pointWinPercentage !== b.pointWinPercentage) {
    return b.pointWinPercentage - a.pointWinPercentage;
  }
  return 0;
}

function bracketTier(qualifier: Qualifier) {
  if (qualifier.qualification === 'wildcard') return Number.MAX_SAFE_INTEGER;
  return qualifier.groupRank;
}

export function qualifierOrder(a: Qualifier, b: Qualifier): number {
  const tier = bracketTier(a) - bracketTier(b);
  if (tier !== 0) return tier;
  return wildcardComparison(a, b);
}

function orderWithOrganizerTiebreak<T extends { playerId: string }>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
  organizerTiebreakOrder: readonly string[] | undefined,
) {
  const ordered = [...items].sort(compare);
  const manualPositions = new Map(
    organizerTiebreakOrder?.map((playerId, index) => [playerId, index]) ?? [],
  );

  for (let index = 0; index < ordered.length; ) {
    const current = ordered[index];
    if (!current) break;
    let end = index + 1;
    while (end < ordered.length && compare(current, ordered[end] as T) === 0) end += 1;
    if (end - index > 1) {
      const tied = ordered.slice(index, end);
      if (tied.every((item) => manualPositions.has(item.playerId))) {
        tied.sort(
          (left, right) =>
            (manualPositions.get(left.playerId) ?? 0) - (manualPositions.get(right.playerId) ?? 0),
        );
        ordered.splice(index, tied.length, ...tied);
      } else {
        throw new OrganizerTiebreakRequiredError(
          'An Organizer Tiebreak Decision is required.',
          tied.map((item) => item.playerId),
        );
      }
    }
    index = end;
  }

  return ordered;
}

function selectWildcardQualifiers(
  candidates: readonly Qualifier[],
  count: number,
  organizerTiebreakOrder: readonly string[] | undefined,
) {
  if (count <= 0) return [];
  if (count >= candidates.length) return Array.from(candidates);

  const ordered = [...candidates].sort(wildcardComparison);
  const cutoff = ordered[count - 1];
  if (!cutoff) return ordered;

  const firstTiedIndex = ordered.findIndex(
    (candidate) => wildcardComparison(candidate, cutoff) === 0,
  );
  const lastTiedIndex =
    ordered.length -
    1 -
    [...ordered].reverse().findIndex((candidate) => wildcardComparison(candidate, cutoff) === 0);

  if (firstTiedIndex < count && lastTiedIndex >= count) {
    const tied = ordered.slice(firstTiedIndex, lastTiedIndex + 1);
    const manualPositions = new Map(
      organizerTiebreakOrder?.map((playerId, index) => [playerId, index]) ?? [],
    );
    if (!tied.every((candidate) => manualPositions.has(candidate.playerId))) {
      throw new OrganizerTiebreakRequiredError(
        'An Organizer Tiebreak Decision is required.',
        tied.map((candidate) => candidate.playerId),
      );
    }
    tied.sort(
      (left, right) =>
        (manualPositions.get(left.playerId) ?? 0) - (manualPositions.get(right.playerId) ?? 0),
    );
    ordered.splice(firstTiedIndex, tied.length, ...tied);
  }

  return ordered.slice(0, count);
}

export function seedQualifiers(
  qualifiers: readonly Qualifier[],
  options: { organizerTiebreakOrder?: readonly string[] } = {},
) {
  return orderWithOrganizerTiebreak(qualifiers, qualifierOrder, options.organizerTiebreakOrder);
}

export function selectTournamentQualifiers(
  groups: readonly GroupStandings[],
  options: {
    automaticQualifiersPerGroup: number;
    wildcardQualifiers: number;
    organizerTiebreakOrder?: readonly string[];
  },
) {
  const automaticQualifiers = groups.flatMap((group) =>
    group.standings
      .filter((standing) => standing.rank <= options.automaticQualifiersPerGroup)
      .map((standing) => qualifierFromStanding(group.groupId, standing, 'automatic')),
  );

  const wildcardRank = options.automaticQualifiersPerGroup + 1;
  const wildcardCandidates = groups.flatMap((group) =>
    group.standings
      .filter((standing) => standing.rank === wildcardRank)
      .map((standing) => qualifierFromStanding(group.groupId, standing, 'wildcard')),
  );
  const wildcardQualifiers = selectWildcardQualifiers(
    wildcardCandidates,
    options.wildcardQualifiers,
    options.organizerTiebreakOrder,
  );

  return seedQualifiers(
    [...automaticQualifiers, ...wildcardQualifiers],
    options.organizerTiebreakOrder
      ? { organizerTiebreakOrder: options.organizerTiebreakOrder }
      : {},
  );
}

export function createFirstRound(
  qualifiers: readonly Qualifier[],
  options: { organizerTiebreakOrder?: readonly string[] } = {},
): FirstRoundFixture[] {
  if (new Set(qualifiers.map((item) => item.playerId)).size !== qualifiers.length) {
    throw new Error('A player can qualify only once.');
  }
  const ordered = seedQualifiers(qualifiers, options);
  const bracketSize = nextPowerOfTwo(ordered.length);
  const highSeeds = ordered.slice(0, bracketSize / 2);
  const lowSeeds: Array<Qualifier | null> = [
    ...ordered.slice(bracketSize / 2).reverse(),
    ...Array<null>(bracketSize - ordered.length).fill(null),
  ];

  const fixtures: FirstRoundFixture[] = [];
  for (let index = 0; index < highSeeds.length; index += 1) {
    const high = highSeeds[index];
    if (!high) continue;
    let lowIndex = index;
    let low = lowSeeds[lowIndex] ?? null;
    if (low?.groupId === high.groupId) {
      const replacement = lowSeeds.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex > index && candidate !== null && candidate.groupId !== high.groupId,
      );
      if (replacement >= 0) {
        [lowSeeds[lowIndex], lowSeeds[replacement]] = [lowSeeds[replacement] ?? null, low];
        low = lowSeeds[lowIndex] ?? null;
      } else {
        const previous = lowSeeds.findIndex((candidate, candidateIndex) => {
          const previousHigh = highSeeds[candidateIndex];
          return (
            candidateIndex < index &&
            candidate !== null &&
            previousHigh !== undefined &&
            candidate.groupId !== high.groupId &&
            low !== null &&
            low.groupId !== previousHigh.groupId
          );
        });
        if (previous >= 0) {
          [lowSeeds[lowIndex], lowSeeds[previous]] = [lowSeeds[previous] ?? null, low];
          low = lowSeeds[lowIndex] ?? null;
        }
      }
    }
    fixtures.push({
      position: index + 1,
      playerOneId: high.playerId,
      playerTwoId: low?.playerId ?? null,
      byePlayerId: low ? null : high.playerId,
    });
  }
  return fixtures;
}

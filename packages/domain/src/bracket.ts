import type { FirstRoundFixture, Qualifier } from './types';

export function nextPowerOfTwo(value: number): number {
  if (!Number.isInteger(value) || value < 2)
    throw new Error('A bracket needs at least two qualifiers.');
  return 2 ** Math.ceil(Math.log2(value));
}

export function qualifierOrder(a: Qualifier, b: Qualifier): number {
  if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.setDifferential !== b.setDifferential) return b.setDifferential - a.setDifferential;
  if (a.pointDifferential !== b.pointDifferential) return b.pointDifferential - a.pointDifferential;
  return a.playerId.localeCompare(b.playerId);
}

export function createFirstRound(qualifiers: readonly Qualifier[]): FirstRoundFixture[] {
  if (new Set(qualifiers.map((item) => item.playerId)).size !== qualifiers.length) {
    throw new Error('A player can qualify only once.');
  }
  const ordered = [...qualifiers].sort(qualifierOrder);
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

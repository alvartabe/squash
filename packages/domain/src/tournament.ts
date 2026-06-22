export type GroupAssignment = { groupPosition: number; playerIds: string[] };
export type RoundRobinPair = { playerOneId: string; playerTwoId: string; round: number };

export function assignPlayersToGroups(
  seededPlayerIds: readonly string[],
  maximumGroupSize: number,
): GroupAssignment[] {
  if (maximumGroupSize < 2) throw new Error('Group size must be at least two.');
  if (new Set(seededPlayerIds).size !== seededPlayerIds.length) {
    throw new Error('A player can appear only once.');
  }
  if (seededPlayerIds.length < 2) throw new Error('A tournament needs at least two players.');

  const groupCount = Math.ceil(seededPlayerIds.length / maximumGroupSize);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    groupPosition: index + 1,
    playerIds: [] as string[],
  }));

  seededPlayerIds.forEach((playerId, index) => {
    const row = Math.floor(index / groupCount);
    const offset = index % groupCount;
    const groupIndex = row % 2 === 0 ? offset : groupCount - offset - 1;
    groups[groupIndex]?.playerIds.push(playerId);
  });
  return groups;
}

export function createRoundRobinPairs(playerIds: readonly string[]): RoundRobinPair[] {
  if (new Set(playerIds).size !== playerIds.length) throw new Error('Duplicate player in group.');
  if (playerIds.length < 2) return [];

  const rotation: Array<string | null> = [...playerIds];
  if (rotation.length % 2 === 1) rotation.push(null);
  const rounds = rotation.length - 1;
  const half = rotation.length / 2;
  const pairs: RoundRobinPair[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const one = rotation[index];
      const two = rotation[rotation.length - 1 - index];
      if (one && two) pairs.push({ playerOneId: one, playerTwoId: two, round: round + 1 });
    }
    const fixed = rotation[0] ?? null;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? null);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }
  return pairs;
}

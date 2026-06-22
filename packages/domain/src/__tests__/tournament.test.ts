import { assignPlayersToGroups, createRoundRobinPairs } from '../tournament';

test('uses snake seeding to create balanced groups', () => {
  const groups = assignPlayersToGroups(['1', '2', '3', '4', '5', '6', '7', '8'], 4);
  expect(groups).toEqual([
    { groupPosition: 1, playerIds: ['1', '4', '5', '8'] },
    { groupPosition: 2, playerIds: ['2', '3', '6', '7'] },
  ]);
});

test('creates every round-robin pairing exactly once', () => {
  const pairs = createRoundRobinPairs(['a', 'b', 'c', 'd']);
  expect(pairs).toHaveLength(6);
  expect(
    new Set(pairs.map((pair) => [pair.playerOneId, pair.playerTwoId].sort().join(':'))).size,
  ).toBe(6);
  expect(new Set(pairs.map((pair) => pair.round))).toEqual(new Set([1, 2, 3]));
});

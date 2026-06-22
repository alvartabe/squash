import { createFirstRound } from '../bracket';

test('adds byes and avoids same-group first-round matches when possible', () => {
  const fixtures = createFirstRound([
    {
      playerId: 'a1',
      groupId: 'a',
      groupRank: 1,
      wins: 3,
      setDifferential: 8,
      pointDifferential: 30,
    },
    {
      playerId: 'b1',
      groupId: 'b',
      groupRank: 1,
      wins: 3,
      setDifferential: 7,
      pointDifferential: 25,
    },
    {
      playerId: 'c1',
      groupId: 'c',
      groupRank: 1,
      wins: 2,
      setDifferential: 4,
      pointDifferential: 15,
    },
    {
      playerId: 'a2',
      groupId: 'a',
      groupRank: 2,
      wins: 2,
      setDifferential: 2,
      pointDifferential: 5,
    },
    {
      playerId: 'b2',
      groupId: 'b',
      groupRank: 2,
      wins: 1,
      setDifferential: -1,
      pointDifferential: -3,
    },
    {
      playerId: 'c2',
      groupId: 'c',
      groupRank: 2,
      wins: 1,
      setDifferential: -2,
      pointDifferential: -8,
    },
  ]);

  expect(fixtures).toHaveLength(4);
  expect(fixtures.filter((fixture) => fixture.byePlayerId)).toHaveLength(2);
  const groupByPlayer = new Map([
    ['a1', 'a'],
    ['a2', 'a'],
    ['b1', 'b'],
    ['b2', 'b'],
    ['c1', 'c'],
    ['c2', 'c'],
  ]);
  for (const fixture of fixtures.filter((item) => item.playerTwoId !== null)) {
    expect(groupByPlayer.get(fixture.playerOneId ?? '')).not.toBe(
      groupByPlayer.get(fixture.playerTwoId ?? ''),
    );
  }
});

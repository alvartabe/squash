import { calculateStandings } from '../standings';

test('uses head-to-head before set differential for a two-player tie', () => {
  const standings = calculateStandings(
    ['a', 'b', 'c'],
    [
      {
        playerOneId: 'a',
        playerTwoId: 'b',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 50,
        playerTwoPoints: 52,
      },
      {
        playerOneId: 'b',
        playerTwoId: 'c',
        playerOneSets: 3,
        playerTwoSets: 0,
        playerOnePoints: 33,
        playerTwoPoints: 10,
      },
      {
        playerOneId: 'c',
        playerTwoId: 'a',
        playerOneSets: 0,
        playerTwoSets: 3,
        playerOnePoints: 8,
        playerTwoPoints: 33,
      },
    ],
  );
  expect(standings.map((row) => row.playerId)).toEqual(['a', 'b', 'c']);
});

test('uses set differential for a circular three-player tie', () => {
  const standings = calculateStandings(
    ['a', 'b', 'c'],
    [
      {
        playerOneId: 'a',
        playerTwoId: 'b',
        playerOneSets: 3,
        playerTwoSets: 0,
        playerOnePoints: 33,
        playerTwoPoints: 20,
      },
      {
        playerOneId: 'b',
        playerTwoId: 'c',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 50,
        playerTwoPoints: 45,
      },
      {
        playerOneId: 'c',
        playerTwoId: 'a',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 50,
        playerTwoPoints: 45,
      },
    ],
  );
  expect(standings.map((row) => row.playerId)).toEqual(['a', 'c', 'b']);
});

test('uses point differential and then points scored for circular ties', () => {
  const byDifferential = calculateStandings(
    ['a', 'b', 'c'],
    [
      {
        playerOneId: 'a',
        playerTwoId: 'b',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 50,
        playerTwoPoints: 40,
      },
      {
        playerOneId: 'b',
        playerTwoId: 'c',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 50,
        playerTwoPoints: 45,
      },
      {
        playerOneId: 'c',
        playerTwoId: 'a',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 60,
        playerTwoPoints: 55,
      },
    ],
  );
  expect(byDifferential.map((row) => row.playerId)).toEqual(['a', 'c', 'b']);

  const byPointsScored = calculateStandings(
    ['a', 'b', 'c'],
    [
      {
        playerOneId: 'a',
        playerTwoId: 'b',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 50,
        playerTwoPoints: 40,
      },
      {
        playerOneId: 'b',
        playerTwoId: 'c',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 60,
        playerTwoPoints: 50,
      },
      {
        playerOneId: 'c',
        playerTwoId: 'a',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 70,
        playerTwoPoints: 60,
      },
    ],
  );
  expect(byPointsScored.map((row) => row.playerId)).toEqual(['c', 'a', 'b']);
});

test('uses player id as the deterministic final draw', () => {
  const standings = calculateStandings(
    ['c', 'b', 'a'],
    [
      {
        playerOneId: 'a',
        playerTwoId: 'b',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 11,
        playerTwoPoints: 10,
      },
      {
        playerOneId: 'b',
        playerTwoId: 'c',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 11,
        playerTwoPoints: 10,
      },
      {
        playerOneId: 'c',
        playerTwoId: 'a',
        playerOneSets: 3,
        playerTwoSets: 2,
        playerOnePoints: 11,
        playerTwoPoints: 10,
      },
    ],
  );
  expect(standings.map((row) => row.playerId)).toEqual(['a', 'b', 'c']);
});

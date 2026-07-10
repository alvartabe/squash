import { calculateStandings, OrganizerTiebreakRequiredError } from '../standings';
import type { GroupMatch } from '../types';

const match = (
  playerOneId: string,
  playerTwoId: string,
  playerOneSets: number,
  playerTwoSets: number,
  playerOnePoints: number,
  playerTwoPoints: number,
): GroupMatch => ({
  playerOneId,
  playerTwoId,
  playerOneSets,
  playerTwoSets,
  playerOnePoints,
  playerTwoPoints,
});

test('uses head-to-head before game differential for a two-player tie', () => {
  const standings = calculateStandings(
    ['a', 'b', 'c'],
    [match('a', 'b', 3, 2, 50, 52), match('b', 'c', 3, 0, 33, 10), match('c', 'a', 0, 3, 8, 33)],
  );
  expect(standings.map((row) => row.playerId)).toEqual(['a', 'b', 'c']);
});

test('uses only matches among tied Players for three-player tiebreak metrics', () => {
  const standings = calculateStandings(
    ['a', 'b', 'c', 'd'],
    [
      match('a', 'b', 3, 0, 33, 20),
      match('b', 'c', 3, 2, 50, 45),
      match('c', 'a', 3, 2, 50, 45),
      match('a', 'd', 3, 0, 33, 0),
      match('b', 'd', 3, 0, 33, 0),
      match('c', 'd', 3, 0, 33, 30),
    ],
  );

  expect(standings.map((row) => row.playerId)).toEqual(['c', 'a', 'b', 'd']);
});

test('returns to head-to-head whenever a larger tie is reduced to two Players', () => {
  const standings = calculateStandings(
    ['a', 'b', 'c', 'd'],
    [
      match('a', 'b', 3, 2, 55, 50),
      match('b', 'c', 3, 0, 33, 20),
      match('c', 'a', 3, 2, 55, 50),
      match('a', 'd', 3, 0, 33, 8),
      match('b', 'd', 3, 0, 33, 8),
      match('c', 'd', 3, 0, 33, 8),
    ],
  );

  expect(standings.map((row) => row.playerId)).toEqual(['a', 'b', 'c', 'd']);
});

test('requires an Organizer Tiebreak Decision when statistics cannot separate Players', () => {
  try {
    calculateStandings(
      ['c', 'b', 'a'],
      [match('a', 'b', 3, 2, 11, 10), match('b', 'c', 3, 2, 11, 10), match('c', 'a', 3, 2, 11, 10)],
    );
    throw new Error('Expected an Organizer Tiebreak Decision requirement.');
  } catch (error) {
    expect(error).toBeInstanceOf(OrganizerTiebreakRequiredError);
    expect(error).toMatchObject({
      context: 'group-standings',
      playerIds: ['c', 'b', 'a'],
    });
  }
});

test('uses the Organizer Tiebreak Decision without requiring a written reason', () => {
  const standings = calculateStandings(
    ['c', 'b', 'a'],
    [match('a', 'b', 3, 2, 11, 10), match('b', 'c', 3, 2, 11, 10), match('c', 'a', 3, 2, 11, 10)],
    { organizerTiebreakOrder: ['b', 'c', 'a'] },
  );

  expect(standings.map((row) => row.playerId)).toEqual(['b', 'c', 'a']);
});

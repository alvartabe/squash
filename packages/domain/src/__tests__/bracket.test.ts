import { createFirstRound, seedQualifiers, selectTournamentQualifiers } from '../bracket';
import { OrganizerTiebreakRequiredError } from '../standings';
import type { Qualifier, Standing } from '../types';

function qualifier(input: {
  playerId: string;
  groupId: string;
  groupRank: number;
  qualification?: Qualifier['qualification'];
  matchWinPercentage: number;
  gameWinPercentage: number;
  pointWinPercentage: number;
}): Qualifier {
  return {
    qualification: 'automatic',
    wins: 0,
    matchesPlayed: 0,
    setsWon: 0,
    setsLost: 0,
    setDifferential: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifferential: 0,
    ...input,
  };
}

function standing(input: {
  playerId: string;
  rank: number;
  wins: number;
  played: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
}): Standing {
  return {
    losses: input.played - input.wins,
    setDifferential: input.setsWon - input.setsLost,
    pointDifferential: input.pointsFor - input.pointsAgainst,
    matchWinPercentage: input.played === 0 ? 0 : input.wins / input.played,
    gameWinPercentage:
      input.setsWon + input.setsLost === 0 ? 0 : input.setsWon / (input.setsWon + input.setsLost),
    pointWinPercentage:
      input.pointsFor + input.pointsAgainst === 0
        ? 0
        : input.pointsFor / (input.pointsFor + input.pointsAgainst),
    ...input,
  };
}

test('selects Automatic Qualifiers plus Wildcards by normalized percentages', () => {
  const qualifiers = selectTournamentQualifiers(
    [
      {
        groupId: 'a',
        standings: [
          standing({
            playerId: 'a1',
            rank: 1,
            wins: 3,
            played: 3,
            setsWon: 9,
            setsLost: 0,
            pointsFor: 99,
            pointsAgainst: 60,
          }),
          standing({
            playerId: 'a2',
            rank: 2,
            wins: 1,
            played: 3,
            setsWon: 4,
            setsLost: 6,
            pointsFor: 120,
            pointsAgainst: 90,
          }),
        ],
      },
      {
        groupId: 'b',
        standings: [
          standing({
            playerId: 'b1',
            rank: 1,
            wins: 2,
            played: 2,
            setsWon: 6,
            setsLost: 0,
            pointsFor: 66,
            pointsAgainst: 30,
          }),
          standing({
            playerId: 'b2',
            rank: 2,
            wins: 1,
            played: 2,
            setsWon: 3,
            setsLost: 3,
            pointsFor: 66,
            pointsAgainst: 60,
          }),
        ],
      },
    ],
    { automaticQualifiersPerGroup: 1, wildcardQualifiers: 1 },
  );

  expect(qualifiers.map((item) => item.playerId)).toEqual(['b1', 'a1', 'b2']);
  expect(qualifiers.find((item) => item.playerId === 'b2')?.qualification).toBe('wildcard');
});

test('requires a wildcard-cutoff Organizer Tiebreak Decision for exactly the cutoff Players', () => {
  try {
    selectTournamentQualifiers(
      [
        {
          groupId: 'a',
          standings: [
            standing({
              playerId: 'a1',
              rank: 1,
              wins: 2,
              played: 2,
              setsWon: 6,
              setsLost: 0,
              pointsFor: 66,
              pointsAgainst: 20,
            }),
            standing({
              playerId: 'a2',
              rank: 2,
              wins: 1,
              played: 2,
              setsWon: 3,
              setsLost: 3,
              pointsFor: 50,
              pointsAgainst: 50,
            }),
          ],
        },
        {
          groupId: 'b',
          standings: [
            standing({
              playerId: 'b1',
              rank: 1,
              wins: 2,
              played: 2,
              setsWon: 6,
              setsLost: 0,
              pointsFor: 66,
              pointsAgainst: 20,
            }),
            standing({
              playerId: 'b2',
              rank: 2,
              wins: 1,
              played: 2,
              setsWon: 3,
              setsLost: 3,
              pointsFor: 50,
              pointsAgainst: 50,
            }),
          ],
        },
      ],
      { automaticQualifiersPerGroup: 1, wildcardQualifiers: 1 },
    );
    throw new Error('Expected an Organizer Tiebreak Decision requirement.');
  } catch (error) {
    expect(error).toBeInstanceOf(OrganizerTiebreakRequiredError);
    expect(error).toMatchObject({
      context: 'wildcard-cutoff',
      playerIds: ['a2', 'b2'],
    });
  }
});

test('does not reuse a Wildcard cutoff decision as a Knockout seeding decision', () => {
  const groups = ['a', 'b'].map((groupId) => ({
    groupId,
    standings: [
      standing({
        playerId: `${groupId}1`,
        rank: 1,
        wins: 2,
        played: 2,
        setsWon: 6,
        setsLost: 0,
        pointsFor: 66,
        pointsAgainst: 20,
      }),
      standing({
        playerId: `${groupId}2`,
        rank: 2,
        wins: 1,
        played: 2,
        setsWon: 3,
        setsLost: 3,
        pointsFor: 50,
        pointsAgainst: 50,
      }),
    ],
  }));

  try {
    selectTournamentQualifiers(groups, {
      automaticQualifiersPerGroup: 1,
      wildcardQualifiers: 1,
      organizerTiebreakOrders: { 'wildcard-cutoff': ['b2', 'a2'] },
    });
    throw new Error('Expected a Knockout seeding decision requirement.');
  } catch (error) {
    expect(error).toBeInstanceOf(OrganizerTiebreakRequiredError);
    expect(error).toMatchObject({
      context: 'knockout-seeding',
      playerIds: ['a1', 'b1'],
    });
  }
});

test('uses the Wildcard cutoff decision to select the qualifying Player', () => {
  const qualifiers = selectTournamentQualifiers(
    [
      {
        groupId: 'a',
        standings: [
          standing({
            playerId: 'a1',
            rank: 1,
            wins: 2,
            played: 2,
            setsWon: 6,
            setsLost: 0,
            pointsFor: 66,
            pointsAgainst: 20,
          }),
          standing({
            playerId: 'a2',
            rank: 2,
            wins: 1,
            played: 2,
            setsWon: 3,
            setsLost: 3,
            pointsFor: 50,
            pointsAgainst: 50,
          }),
        ],
      },
      {
        groupId: 'b',
        standings: [
          standing({
            playerId: 'b1',
            rank: 1,
            wins: 2,
            played: 2,
            setsWon: 5,
            setsLost: 1,
            pointsFor: 60,
            pointsAgainst: 30,
          }),
          standing({
            playerId: 'b2',
            rank: 2,
            wins: 1,
            played: 2,
            setsWon: 3,
            setsLost: 3,
            pointsFor: 50,
            pointsAgainst: 50,
          }),
        ],
      },
    ],
    {
      automaticQualifiersPerGroup: 1,
      wildcardQualifiers: 1,
      organizerTiebreakOrders: { 'wildcard-cutoff': ['b2', 'a2'] },
    },
  );

  expect(qualifiers.map((item) => item.playerId)).toEqual(['a1', 'b1', 'b2']);
});

test('seeds group winners before other Automatic Qualifiers and Wildcards', () => {
  const seeded = seedQualifiers([
    qualifier({
      playerId: 'second',
      groupId: 'a',
      groupRank: 2,
      matchWinPercentage: 1,
      gameWinPercentage: 1,
      pointWinPercentage: 1,
    }),
    qualifier({
      playerId: 'wildcard',
      groupId: 'b',
      groupRank: 3,
      qualification: 'wildcard',
      matchWinPercentage: 1,
      gameWinPercentage: 1,
      pointWinPercentage: 1,
    }),
    qualifier({
      playerId: 'winner',
      groupId: 'c',
      groupRank: 1,
      matchWinPercentage: 0.5,
      gameWinPercentage: 0.5,
      pointWinPercentage: 0.5,
    }),
  ]);

  expect(seeded.map((item) => item.playerId)).toEqual(['winner', 'second', 'wildcard']);
});

test('requires an Organizer Tiebreak Decision for inseparable bracket seeds', () => {
  try {
    seedQualifiers([
      qualifier({
        playerId: 'a1',
        groupId: 'a',
        groupRank: 1,
        matchWinPercentage: 1,
        gameWinPercentage: 1,
        pointWinPercentage: 1,
      }),
      qualifier({
        playerId: 'b1',
        groupId: 'b',
        groupRank: 1,
        matchWinPercentage: 1,
        gameWinPercentage: 1,
        pointWinPercentage: 1,
      }),
    ]);
    throw new Error('Expected an Organizer Tiebreak Decision requirement.');
  } catch (error) {
    expect(error).toBeInstanceOf(OrganizerTiebreakRequiredError);
    expect(error).toMatchObject({
      context: 'knockout-seeding',
      playerIds: ['a1', 'b1'],
    });
  }
});

test('uses the Knockout seeding decision for statistically inseparable qualifiers', () => {
  const seeded = seedQualifiers(
    [
      qualifier({
        playerId: 'a1',
        groupId: 'a',
        groupRank: 1,
        matchWinPercentage: 1,
        gameWinPercentage: 1,
        pointWinPercentage: 1,
      }),
      qualifier({
        playerId: 'b1',
        groupId: 'b',
        groupRank: 1,
        matchWinPercentage: 1,
        gameWinPercentage: 1,
        pointWinPercentage: 1,
      }),
    ],
    { organizerTiebreakOrder: ['b1', 'a1'] },
  );

  expect(seeded.map((item) => item.playerId)).toEqual(['b1', 'a1']);
});

test('gives required byes to the highest Knockout Seeds', () => {
  const fixtures = createFirstRound(
    Array.from({ length: 6 }, (_, index) =>
      qualifier({
        playerId: `seed-${index + 1}`,
        groupId: `group-${index + 1}`,
        groupRank: 1,
        matchWinPercentage: 1 - index * 0.1,
        gameWinPercentage: 1 - index * 0.1,
        pointWinPercentage: 1 - index * 0.1,
      }),
    ),
  );

  expect(fixtures[0]).toMatchObject({
    playerOneId: 'seed-1',
    playerTwoId: null,
    byePlayerId: 'seed-1',
  });
  expect(fixtures[1]).toMatchObject({
    playerOneId: 'seed-2',
    playerTwoId: null,
    byePlayerId: 'seed-2',
  });
  expect(fixtures.filter((fixture) => fixture.byePlayerId !== null)).toHaveLength(2);
});

test('adds byes and avoids same-group first-round matches when possible', () => {
  const fixtures = createFirstRound([
    qualifier({
      playerId: 'a1',
      groupId: 'a',
      groupRank: 1,
      matchWinPercentage: 1,
      gameWinPercentage: 0.9,
      pointWinPercentage: 0.8,
    }),
    qualifier({
      playerId: 'b1',
      groupId: 'b',
      groupRank: 1,
      matchWinPercentage: 0.9,
      gameWinPercentage: 0.8,
      pointWinPercentage: 0.7,
    }),
    qualifier({
      playerId: 'c1',
      groupId: 'c',
      groupRank: 1,
      matchWinPercentage: 0.8,
      gameWinPercentage: 0.7,
      pointWinPercentage: 0.6,
    }),
    qualifier({
      playerId: 'a2',
      groupId: 'a',
      groupRank: 2,
      matchWinPercentage: 0.7,
      gameWinPercentage: 0.6,
      pointWinPercentage: 0.5,
    }),
    qualifier({
      playerId: 'b2',
      groupId: 'b',
      groupRank: 2,
      matchWinPercentage: 0.6,
      gameWinPercentage: 0.5,
      pointWinPercentage: 0.4,
    }),
    qualifier({
      playerId: 'c2',
      groupId: 'c',
      groupRank: 2,
      matchWinPercentage: 0.5,
      gameWinPercentage: 0.4,
      pointWinPercentage: 0.3,
    }),
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

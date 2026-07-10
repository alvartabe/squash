import {
  challenges,
  matchParticipants,
  matchRuleSnapshots,
  matches,
  outboxEvents,
  tournamentAdvancements,
  tournamentFixtures,
} from '@squash/db/schema';
import { db } from '../database';
import {
  cancelChallenge,
  createChallenge,
  disputeChallenge,
  progressTournament,
  respondToFriend,
  submitMatchResult,
} from '../services';

jest.mock('../database', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    transaction: jest.fn(),
    update: jest.fn(),
  },
}));

type MockDatabase = {
  select: jest.Mock;
  update: jest.Mock;
  transaction: jest.Mock;
};

const mockDb = db as unknown as MockDatabase;

function mockSelect(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockJoinedSelect(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const innerJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ innerJoin }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockOrderedSelect(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockWhereSelect(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockJoinedWhereSelect(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const innerJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ innerJoin }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockUpdate(rows: unknown[]) {
  const returning = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ returning }));
  const set = jest.fn(() => ({ where }));
  mockDb.update.mockReturnValueOnce({ set });
}

describe('friendship service authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not let the requester accept their own request', async () => {
    mockSelect([
      { requesterId: 'requester', addresseeId: 'addressee', status: 'pending' as const },
    ]);

    await expect(respondToFriend('requester', 'friendship-id', 'accepted')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('lets the addressee accept a pending request', async () => {
    const accepted = {
      id: 'friendship-id',
      requesterId: 'requester',
      addresseeId: 'addressee',
      status: 'accepted' as const,
    };
    mockSelect([
      { requesterId: 'requester', addresseeId: 'addressee', status: 'pending' as const },
    ]);
    mockUpdate([accepted]);

    await expect(respondToFriend('addressee', 'friendship-id', 'accepted')).resolves.toEqual(
      accepted,
    );
  });
});

describe('challenge service authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an accepted-friend challenge without a club', async () => {
    mockSelect([{ requesterId: 'creator', addresseeId: 'opponent', status: 'accepted' as const }]);

    const captured: Array<{ table: unknown; values: unknown }> = [];
    const tx = {
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          captured.push({ table, values });
          if (table === matchParticipants || table === outboxEvents) return Promise.resolve();
          return {
            returning: async () => {
              if (table === matchRuleSnapshots) return [{ id: 'rules-id' }];
              if (table === matches) return [{ id: 'match-id' }];
              if (table === challenges) return [{ id: 'challenge-id' }];
              return [];
            },
          };
        },
      })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );

    await createChallenge('creator', {
      opponentId: 'opponent',
      scheduledAt: '2026-07-03T18:00:00-06:00',
      timeZone: 'America/Costa_Rica',
      rules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
    });

    expect(captured.find((entry) => entry.table === matches)?.values).toMatchObject({
      clubId: null,
      source: 'challenge',
    });
    expect(captured.find((entry) => entry.table === challenges)?.values).toMatchObject({
      clubId: null,
      creatorId: 'creator',
      opponentId: 'opponent',
    });
  });

  it('does not accept a result while the challenge is pending', async () => {
    mockJoinedSelect([
      {
        id: 'match-id',
        clubId: null,
        source: 'challenge',
        status: 'scheduled',
        countsForStatistics: true,
        revision: 0,
        bestOf: 1,
        pointsToWin: 11,
        winByTwo: true,
      },
    ]);
    mockOrderedSelect([
      { userId: 'creator', position: 1 },
      { userId: 'opponent', position: 2 },
    ]);
    mockSelect([{ status: 'pending' as const }]);

    await expect(
      submitMatchResult('creator', 'match-id', [{ playerOnePoints: 11, playerTwoPoints: 5 }]),
    ).rejects.toMatchObject({
      code: 'MATCH_NOT_READY_FOR_RESULT',
      status: 409,
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('requires a platform administrator to correct a clubless result', async () => {
    mockJoinedSelect([
      {
        id: 'match-id',
        clubId: null,
        source: 'challenge',
        status: 'completed',
        countsForStatistics: true,
        revision: 1,
        bestOf: 1,
        pointsToWin: 11,
        winByTwo: true,
      },
    ]);
    mockOrderedSelect([
      { userId: 'creator', position: 1 },
      { userId: 'opponent', position: 2 },
    ]);
    mockSelect([{ role: 'user' as const }]);

    await expect(
      submitMatchResult(
        'creator',
        'match-id',
        [{ playerOnePoints: 11, playerTwoPoints: 5 }],
        'Incorrect score',
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('cancels an accepted challenge and voids its match atomically', async () => {
    mockJoinedSelect([
      {
        id: 'challenge-id',
        clubId: null,
        matchId: 'match-id',
        creatorId: 'creator',
        opponentId: 'opponent',
        status: 'accepted' as const,
        matchStatus: 'scheduled' as const,
      },
    ]);
    const updates: Array<{ table: unknown; values: unknown }> = [];
    const tx = {
      update: jest.fn((table: unknown) => ({
        set: (values: unknown) => {
          updates.push({ table, values });
          return {
            where: () => ({
              returning: async () =>
                table === challenges
                  ? [{ id: 'challenge-id', status: 'cancelled' }]
                  : [{ id: 'match-id' }],
            }),
          };
        },
      })),
      insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );

    await cancelChallenge('opponent', 'challenge-id', 'Schedule changed');

    expect(updates.find((entry) => entry.table === challenges)?.values).toMatchObject({
      status: 'cancelled',
    });
    expect(updates.find((entry) => entry.table === matches)?.values).toMatchObject({
      status: 'void',
    });
  });

  it('disputes a completed challenge and queues a statistics rebuild', async () => {
    mockJoinedSelect([
      {
        id: 'challenge-id',
        clubId: null,
        matchId: 'match-id',
        creatorId: 'creator',
        opponentId: 'opponent',
        status: 'completed' as const,
        matchStatus: 'completed' as const,
      },
    ]);
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const tx = {
      update: jest.fn((table: unknown) => ({
        set: () => ({
          where: () => ({
            returning: async () =>
              table === challenges
                ? [{ id: 'challenge-id', status: 'disputed' }]
                : [{ id: 'match-id' }],
          }),
        }),
      })),
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );

    await disputeChallenge('creator', 'challenge-id', 'The second set is incorrect');

    expect(inserts.find((entry) => entry.table === outboxEvents)?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topic: 'statistics.rebuild',
          aggregateId: 'match-id',
        }),
      ]),
    );
  });
});

describe('tournament progression', () => {
  beforeEach(() => jest.clearAllMocks());

  it('waits for an Organizer Tiebreak Decision instead of using an arbitrary bracket seed', async () => {
    mockSelect([
      {
        id: 'tournament-id',
        status: 'group-stage',
        qualifiersPerGroup: 1,
        wildcardQualifiers: 0,
      },
    ]);
    mockWhereSelect([{ id: 'group-id' }]);
    mockWhereSelect([{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
    mockJoinedWhereSelect([
      {
        matchId: 'match-ab',
        playerOneId: 'a',
        playerTwoId: 'b',
        status: 'completed',
      },
      {
        matchId: 'match-bc',
        playerOneId: 'b',
        playerTwoId: 'c',
        status: 'completed',
      },
      {
        matchId: 'match-ca',
        playerOneId: 'c',
        playerTwoId: 'a',
        status: 'completed',
      },
    ]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    mockSelect([]);

    await expect(progressTournament('tournament-id')).resolves.toMatchObject({
      progressed: false,
      reason: 'manual-tiebreak-required',
      requirement: {
        context: 'group-standings',
        groupId: 'group-id',
        playerIds: ['a', 'b', 'c'],
        requirementKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('applies a recorded Group-standing decision and resumes Knockout progression', async () => {
    mockSelect([
      {
        id: 'tournament-id',
        clubId: 'club-id',
        rulesId: 'rules-id',
        status: 'group-stage',
        qualifiersPerGroup: 2,
        wildcardQualifiers: 0,
      },
    ]);
    mockWhereSelect([{ id: 'group-id' }]);
    mockWhereSelect([{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
    mockJoinedWhereSelect([
      { matchId: 'match-ab', playerOneId: 'a', playerTwoId: 'b', status: 'completed', revision: 1 },
      { matchId: 'match-bc', playerOneId: 'b', playerTwoId: 'c', status: 'completed', revision: 1 },
      { matchId: 'match-ca', playerOneId: 'c', playerTwoId: 'a', status: 'completed', revision: 1 },
    ]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    mockSelect([
      {
        context: 'group-standings',
        groupId: 'group-id',
        orderedPlayerIds: ['b', 'c', 'a'],
      },
    ]);

    const participantInserts: unknown[] = [];
    const tx = {
      update: jest.fn(() => ({ set: () => ({ where: jest.fn() }) })),
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          if (table === tournamentFixtures) {
            return { returning: async () => [{ id: 'fixture-1', position: 1 }] };
          }
          if (table === matches) {
            return { returning: async () => [{ id: 'knockout-match-1' }] };
          }
          if (table === matchParticipants) participantInserts.push(values);
          return {};
        },
      })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(progressTournament('tournament-id')).resolves.toMatchObject({
      progressed: true,
      qualifiers: 2,
      rounds: 1,
    });
    expect(participantInserts).toContainEqual([
      { matchId: 'knockout-match-1', userId: 'b', position: 1 },
      { matchId: 'knockout-match-1', userId: 'c', position: 2 },
    ]);
  });

  it('exposes the next unresolved Group-standing tie after applying an earlier decision', async () => {
    mockSelect([
      {
        id: 'tournament-id',
        status: 'group-stage',
        qualifiersPerGroup: 2,
        wildcardQualifiers: 0,
      },
    ]);
    mockWhereSelect([{ id: 'group-id', position: 1 }]);
    const top = ['t1', 't2', 't3'];
    const bottom = ['b1', 'b2', 'b3'];
    mockWhereSelect([...top, ...bottom].map((userId) => ({ userId })));
    const results: Array<[string, string]> = [
      ['t1', 't2'],
      ['t2', 't3'],
      ['t3', 't1'],
      ...top.flatMap((winner) => bottom.map((loser) => [winner, loser] as [string, string])),
      ['b1', 'b2'],
      ['b2', 'b3'],
      ['b3', 'b1'],
    ];
    mockJoinedWhereSelect(
      results.map(([playerOneId, playerTwoId], index) => ({
        matchId: `match-${index + 1}`,
        playerOneId,
        playerTwoId,
        status: 'completed',
        revision: 1,
      })),
    );
    for (const _result of results) {
      mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 10 }]);
    }
    mockSelect([
      {
        context: 'group-standings',
        groupId: 'group-id',
        orderedPlayerIds: ['t2', 't3', 't1'],
      },
    ]);
    mockSelect([]);

    await expect(progressTournament('tournament-id')).resolves.toMatchObject({
      progressed: false,
      reason: 'manual-tiebreak-required',
      requirement: {
        context: 'group-standings',
        groupId: 'group-id',
        playerIds: bottom,
      },
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('applies independent Knockout-seeding decisions across multiple qualifying tiers', async () => {
    mockSelect([
      {
        id: 'tournament-id',
        clubId: 'club-id',
        rulesId: 'rules-id',
        status: 'group-stage',
        qualifiersPerGroup: 2,
        wildcardQualifiers: 0,
      },
    ]);
    mockWhereSelect([
      { id: 'group-a', position: 1 },
      { id: 'group-b', position: 2 },
    ]);
    for (const group of ['a', 'b']) {
      mockWhereSelect([1, 2, 3].map((position) => ({ userId: `${group}${position}` })));
      mockJoinedWhereSelect([
        {
          matchId: `match-${group}-1-2`,
          playerOneId: `${group}1`,
          playerTwoId: `${group}2`,
          status: 'completed',
          revision: 1,
        },
        {
          matchId: `match-${group}-1-3`,
          playerOneId: `${group}1`,
          playerTwoId: `${group}3`,
          status: 'completed',
          revision: 1,
        },
        {
          matchId: `match-${group}-2-3`,
          playerOneId: `${group}2`,
          playerTwoId: `${group}3`,
          status: 'completed',
          revision: 1,
        },
      ]);
      mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 5 }]);
      mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 5 }]);
      mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 5 }]);
    }
    mockSelect([{ context: 'knockout-seeding', groupId: null, orderedPlayerIds: ['b1', 'a1'] }]);
    mockSelect([{ context: 'knockout-seeding', groupId: null, orderedPlayerIds: ['a2', 'b2'] }]);

    let matchNumber = 0;
    const tx = {
      update: jest.fn(() => ({ set: () => ({ where: jest.fn() }) })),
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          if (table === tournamentFixtures) {
            return {
              returning: async () =>
                (Array.isArray(values) ? values : [values]).map(
                  (fixture: { round: number; position: number }) => ({
                    id: `round-${fixture.round}-position-${fixture.position}`,
                    position: fixture.position,
                  }),
                ),
            };
          }
          if (table === matches) {
            return { returning: async () => [{ id: `match-${(matchNumber += 1)}` }] };
          }
          return {};
        },
      })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(progressTournament('tournament-id')).resolves.toMatchObject({
      progressed: true,
      qualifiers: 4,
      rounds: 2,
    });
  });

  it('creates a later-round Knockout Match when both Players arrive by first-round byes', async () => {
    mockSelect([
      {
        id: 'tournament-id',
        clubId: 'club-id',
        rulesId: 'rules-id',
        status: 'group-stage',
        qualifiersPerGroup: 2,
        wildcardQualifiers: 1,
      },
    ]);
    mockWhereSelect([{ id: 'group-a' }, { id: 'group-b' }]);
    mockWhereSelect([{ userId: 'a1' }, { userId: 'a2' }, { userId: 'a3' }]);
    mockJoinedWhereSelect([
      {
        matchId: 'match-a1-a2',
        playerOneId: 'a1',
        playerTwoId: 'a2',
        status: 'completed',
      },
      {
        matchId: 'match-a1-a3',
        playerOneId: 'a1',
        playerTwoId: 'a3',
        status: 'completed',
      },
      {
        matchId: 'match-a2-a3',
        playerOneId: 'a2',
        playerTwoId: 'a3',
        status: 'completed',
      },
    ]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 5 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 8 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 9 }]);
    mockWhereSelect([{ userId: 'b1' }, { userId: 'b2' }, { userId: 'b3' }]);
    mockJoinedWhereSelect([
      {
        matchId: 'match-b1-b2',
        playerOneId: 'b1',
        playerTwoId: 'b2',
        status: 'completed',
      },
      {
        matchId: 'match-b1-b3',
        playerOneId: 'b1',
        playerTwoId: 'b3',
        status: 'completed',
      },
      {
        matchId: 'match-b2-b3',
        playerOneId: 'b2',
        playerTwoId: 'b3',
        status: 'completed',
      },
    ]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 4 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 1 }]);
    mockWhereSelect([{ playerOnePoints: 11, playerTwoPoints: 1 }]);

    const participantInserts: unknown[] = [];
    const targetFixtures = [
      [{ id: 'round-2-position-1', matchId: null, playerOneId: 'b1', playerTwoId: null }],
      [{ id: 'round-2-position-1', matchId: null, playerOneId: 'b1', playerTwoId: 'a1' }],
      [{ id: 'round-2-position-2', matchId: null, playerOneId: 'b2', playerTwoId: null }],
    ];
    let matchNumber = 0;
    const progressionTransaction = {
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          if (table === tournamentFixtures) {
            return {
              returning: async () =>
                (Array.isArray(values) ? values : [values]).map(
                  (fixture: { round: number; position: number }) => ({
                    id: `round-${fixture.round}-position-${fixture.position}`,
                    position: fixture.position,
                  }),
                ),
            };
          }
          if (table === matches) {
            return {
              returning: async () => [{ id: `knockout-match-${(matchNumber += 1)}` }],
            };
          }
          if (table === matchParticipants) {
            participantInserts.push(values);
          }
          if (table === tournamentAdvancements) {
            return {};
          }
          return {};
        },
      })),
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => targetFixtures.shift() ?? [],
          }),
        }),
      })),
      update: jest.fn(() => ({
        set: () => ({
          where: jest.fn(),
        }),
      })),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (database: typeof progressionTransaction) => unknown) =>
        callback(progressionTransaction),
    );

    await expect(progressTournament('tournament-id')).resolves.toMatchObject({
      progressed: true,
      qualifiers: 5,
      rounds: 3,
    });
    expect(participantInserts).toContainEqual([
      { matchId: 'knockout-match-1', userId: 'b1', position: 1 },
      { matchId: 'knockout-match-1', userId: 'a1', position: 2 },
    ]);
  });
});

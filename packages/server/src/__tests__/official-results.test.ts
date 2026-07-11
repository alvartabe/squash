import {
  auditLogs,
  matches,
  matchParticipants,
  matchResultRevisions,
  matchSets,
  outboxEvents,
  tournamentFixtures,
} from '@squash/db/schema';
import { getClubAuthorization } from '../authorization';
import { db } from '../database';
import { recordOfficialTournamentResult } from '../official-results';

jest.mock('../database', () => ({
  db: { select: jest.fn(), transaction: jest.fn() },
}));

jest.mock('../authorization', () => ({
  getClubAuthorization: jest.fn(),
  requireLockedActiveClub: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };
const mockAuthorization = getClubAuthorization as jest.Mock;

function queryRows(rows: unknown[]) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    for: async () => rows,
    then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
  };
  return query;
}

const fixture = {
  fixtureId: 'fixture-id',
  fixtureTournamentId: 'tournament-id',
  tournamentId: 'tournament-id',
  clubId: 'club-id',
  tournamentStatus: 'group-stage' as const,
  stage: 'group' as const,
  round: 1,
  position: 1,
  groupId: 'group-id',
  advancesToFixtureId: null,
  advancesToPosition: null,
  matchId: 'match-id',
  matchSource: 'tournament' as const,
  matchStatus: 'scheduled' as const,
  currentRevision: 0,
  currentWinnerId: null,
  completedAt: null,
  playerOneId: 'player-1',
  playerTwoId: 'player-2',
  bestOf: 3,
  pointsToWin: 11,
  winByTwo: true,
};

function locateManager(responsibilities: string[] = ['owner']) {
  mockDb.select.mockReturnValueOnce(
    queryRows([{ id: 'tournament-id', clubId: 'club-id', archivedAt: null }]),
  );
  mockAuthorization.mockResolvedValueOnce({ membershipStatus: 'active', responsibilities });
}

function successfulTransaction(
  record: Record<string, unknown> = fixture,
  appointmentRows?: unknown[],
  dependency?: {
    fixture: Record<string, unknown>;
    matchStatus?: 'scheduled' | 'in-progress' | 'completed';
  },
) {
  const writes: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const select = jest.fn().mockReturnValueOnce(queryRows([record]));
  select
    .mockReturnValueOnce(queryRows([{ id: 'organizer-id' }]))
    .mockReturnValueOnce(queryRows([{ status: 'active' }]))
    .mockReturnValueOnce(queryRows([{ responsibility: 'owner' }]));
  if (appointmentRows) select.mockReturnValueOnce(queryRows(appointmentRows));
  if (dependency) {
    select.mockReturnValueOnce(queryRows([dependency.fixture]));
    if (dependency.fixture.matchId) {
      select.mockReturnValueOnce(queryRows([{ status: dependency.matchStatus ?? 'scheduled' }]));
    }
  }
  select.mockReturnValueOnce(
    queryRows([
      { userId: 'player-1', position: 1 },
      { userId: 'player-2', position: 2 },
    ]),
  );
  if (Number(record.currentRevision) > 0) {
    select.mockReturnValueOnce(
      queryRows([
        { playerOnePoints: 11, playerTwoPoints: 7 },
        { playerOnePoints: 11, playerTwoPoints: 9 },
      ]),
    );
  }
  const tx = {
    select,
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    update: jest.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          where: () => ({
            returning: async () => (table === matches ? [{ id: 'match-id' }] : []),
          }),
        };
      },
    })),
    insert: jest.fn((table: unknown) => ({
      values: (values: unknown) => {
        writes.push({ table, values });
        return { returning: async () => [] };
      },
    })),
  };
  mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, writes, updates };
}

const input = {
  expectedRevision: 0 as const,
  games: [
    { playerOnePoints: 11, playerTwoPoints: 7 },
    { playerOnePoints: 11, playerTwoPoints: 9 },
  ],
};

describe('Organizer-controlled Official Results', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([['owner'], ['admin']])('allows an active Club %s', async (responsibility) => {
    locateManager([responsibility]);
    const { writes, updates } = successfulTransaction();

    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', input),
    ).resolves.toMatchObject({
      fixtureId: 'fixture-id',
      matchId: 'match-id',
      winnerId: 'player-1',
      revision: 1,
      games: input.games,
    });

    expect(writes.find(({ table }) => table === matchSets)?.values).toEqual([
      { matchId: 'match-id', setNumber: 1, ...input.games[0] },
      { matchId: 'match-id', setNumber: 2, ...input.games[1] },
    ]);
    expect(updates.find(({ table }) => table === matches)?.values).toMatchObject({
      status: 'completed',
      completedAt: expect.any(Date),
      submittedById: 'organizer-id',
      winnerId: 'player-1',
      currentRevision: 1,
    });
    expect(writes.find(({ table }) => table === matchResultRevisions)?.values).toMatchObject({
      matchId: 'match-id',
      revision: 1,
      submittedById: 'organizer-id',
      reason: null,
    });
    expect(writes.find(({ table }) => table === auditLogs)?.values).toMatchObject({
      actorId: 'organizer-id',
      clubId: 'club-id',
      action: 'tournament.official-result-record',
      entityType: 'match',
      entityId: 'match-id',
      metadata: expect.objectContaining({
        tournamentId: 'tournament-id',
        fixtureId: 'fixture-id',
        playerOneId: 'player-1',
        playerTwoId: 'player-2',
        winnerId: 'player-1',
        organizerId: 'organizer-id',
        games: input.games,
      }),
    });
    expect(writes.find(({ table }) => table === outboxEvents)?.values).toEqual([
      {
        topic: 'statistics.rebuild',
        aggregateId: 'match-id',
        payload: { matchId: 'match-id', source: 'tournament', revision: 1 },
      },
      {
        topic: 'tournament.progress',
        aggregateId: 'match-id',
        payload: { matchId: 'match-id', tournamentId: 'tournament-id', revision: 1 },
      },
    ]);
    expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'serializable',
    });
  });

  it('allows an explicitly appointed active Coach', async () => {
    locateManager(['coach']);
    successfulTransaction(fixture, [{ userId: 'coach-id' }]);
    await expect(
      recordOfficialTournamentResult('coach-id', 'tournament-id', 'fixture-id', input),
    ).resolves.toMatchObject({ winnerId: 'player-1' });
  });

  it('records an available Knockout fixture and queues deterministic progression', async () => {
    locateManager();
    const { writes } = successfulTransaction({
      ...fixture,
      tournamentStatus: 'knockout',
      stage: 'knockout',
      groupId: null,
    });

    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', input),
    ).resolves.toMatchObject({ fixtureId: 'fixture-id', winnerId: 'player-1' });
    expect(writes.find(({ table }) => table === outboxEvents)?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topic: 'tournament.progress',
          payload: { matchId: 'match-id', tournamentId: 'tournament-id', revision: 1 },
        }),
      ]),
    );
  });

  it.each([
    ['unappointed Coach', ['coach']],
    ['Tournament participant', []],
    ['unrelated Player', []],
  ])('rejects an %s', async (_label, responsibilities) => {
    locateManager(responsibilities);
    const { tx } = successfulTransaction(
      fixture,
      responsibilities.includes('coach') ? [] : undefined,
    );
    await expect(
      recordOfficialTournamentResult('player-id', 'tournament-id', 'fixture-id', input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rechecks revoked Organizer authority inside the correction transaction', async () => {
    locateManager([]);
    const { tx } = successfulTransaction({
      ...fixture,
      matchStatus: 'completed',
      currentRevision: 1,
      currentWinnerId: 'player-1',
      completedAt: new Date(),
    });
    await expect(
      recordOfficialTournamentResult('former-organizer', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Correction',
        games: input.games,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'unrelated fixture',
      { ...fixture, fixtureTournamentId: 'other-tournament' },
      'OFFICIAL_RESULT_FIXTURE_MISMATCH',
    ],
    [
      'non-Tournament Match',
      { ...fixture, matchSource: 'challenge' },
      'OFFICIAL_RESULT_MATCH_INVALID',
    ],
    [
      'wrong lifecycle',
      { ...fixture, tournamentStatus: 'knockout' },
      'OFFICIAL_RESULT_TOURNAMENT_STATE_INVALID',
    ],
    [
      'unavailable Knockout fixture',
      { ...fixture, stage: 'knockout', tournamentStatus: 'knockout', playerTwoId: null },
      'OFFICIAL_RESULT_FIXTURE_UNAVAILABLE',
    ],
    ['stale submission', { ...fixture, currentRevision: 1 }, 'OFFICIAL_RESULT_STALE'],
    [
      'duplicate result',
      { ...fixture, matchStatus: 'completed', currentRevision: 1 },
      'OFFICIAL_RESULT_STALE',
    ],
  ])('rejects a %s', async (_label, record, code) => {
    locateManager();
    const { tx } = successfulTransaction(record);
    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', input),
    ).rejects.toMatchObject({ code });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects Match participants that differ from the fixture', async () => {
    locateManager();
    const { tx } = successfulTransaction();
    tx.select
      .mockReset()
      .mockReturnValueOnce(queryRows([fixture]))
      .mockReturnValueOnce(queryRows([{ id: 'organizer-id' }]))
      .mockReturnValueOnce(queryRows([{ status: 'active' }]))
      .mockReturnValueOnce(queryRows([{ responsibility: 'owner' }]))
      .mockReturnValueOnce(
        queryRows([
          { userId: 'player-1', position: 1 },
          { userId: 'unrelated', position: 2 },
        ]),
      );
    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', input),
    ).rejects.toMatchObject({ code: 'OFFICIAL_RESULT_PLAYERS_INVALID' });
  });

  it.each([
    ['incomplete', [{ playerOnePoints: 11, playerTwoPoints: 7 }], 'OFFICIAL_RESULT_GAMES_INVALID'],
    ['tied Game', [{ playerOnePoints: 11, playerTwoPoints: 11 }], 'OFFICIAL_RESULT_GAMES_INVALID'],
    [
      'score after completion',
      [...input.games, { playerOnePoints: 11, playerTwoPoints: 2 }],
      'OFFICIAL_RESULT_GAMES_INVALID',
    ],
  ])('rejects %s Games', async (_label, games, code) => {
    locateManager();
    successfulTransaction();
    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
        expectedRevision: 0,
        games,
      }),
    ).rejects.toMatchObject({ code });
  });

  it('rejects a concurrent finalization when the guarded Match update loses', async () => {
    locateManager();
    const { tx } = successfulTransaction();
    tx.update.mockImplementation(() => ({
      set: () => ({ where: () => ({ returning: async () => [] }) }),
    }));
    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', input),
    ).rejects.toMatchObject({ code: 'OFFICIAL_RESULT_STALE', status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('retries a serialization conflict and rereads revoked authority before writing', async () => {
    locateManager([]);
    const { tx } = successfulTransaction({
      ...fixture,
      matchStatus: 'completed',
      currentRevision: 1,
      currentWinnerId: 'player-1',
      completedAt: new Date(),
    });
    mockDb.transaction.mockReset();
    mockDb.transaction.mockRejectedValueOnce(
      Object.assign(new Error('serialization'), { code: '40001' }),
    );
    mockDb.transaction.mockImplementationOnce(
      async (callback: (database: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      recordOfficialTournamentResult('former-organizer', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Correction',
        games: input.games,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockDb.transaction).toHaveBeenCalledTimes(2);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('corrects an unlocked Group result with a reason and rebuilds statistics atomically', async () => {
    locateManager();
    const completedAt = new Date('2026-07-11T12:00:00.000Z');
    const { tx, writes } = successfulTransaction({
      ...fixture,
      matchStatus: 'completed',
      currentRevision: 1,
      currentWinnerId: 'player-1',
      completedAt,
    });

    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Score sheet correction',
        games: [
          { playerOnePoints: 7, playerTwoPoints: 11 },
          { playerOnePoints: 9, playerTwoPoints: 11 },
        ],
      }),
    ).resolves.toMatchObject({ revision: 2, winnerId: 'player-2' });

    expect(tx.delete).toHaveBeenCalledWith(matchSets);
    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(writes.find(({ table }) => table === matchResultRevisions)?.values).toMatchObject({
      revision: 2,
      reason: 'Score sheet correction',
    });
    expect(writes.find(({ table }) => table === auditLogs)?.values).toMatchObject({
      action: 'tournament.official-result-correct',
      metadata: expect.objectContaining({
        previousWinnerId: 'player-1',
        winnerId: 'player-2',
        reason: 'Score sheet correction',
      }),
    });
  });

  it('does not enqueue progression when the transactional statistics rebuild fails', async () => {
    locateManager();
    const { tx, writes } = successfulTransaction({
      ...fixture,
      matchStatus: 'completed',
      currentRevision: 1,
      currentWinnerId: 'player-1',
      completedAt: new Date(),
    });
    tx.execute.mockRejectedValueOnce(new Error('statistics rebuild failed'));

    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Correction',
        games: input.games,
      }),
    ).rejects.toThrow('statistics rebuild failed');
    expect(writes.some(({ table }) => table === outboxEvents)).toBe(false);
    expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'serializable',
    });
  });

  it('updates an unstarted dependent Knockout fixture when a correction changes the winner', async () => {
    locateManager();
    const { tx, updates } = successfulTransaction(
      {
        ...fixture,
        stage: 'knockout',
        tournamentStatus: 'knockout',
        groupId: null,
        matchStatus: 'completed',
        currentRevision: 1,
        currentWinnerId: 'player-1',
        completedAt: new Date('2026-07-11T12:00:00.000Z'),
        advancesToFixtureId: 'next-fixture',
        advancesToPosition: 1,
      },
      undefined,
      {
        fixture: {
          id: 'next-fixture',
          matchId: 'next-match',
          playerOneId: 'player-1',
          playerTwoId: 'player-3',
        },
      },
    );

    await recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
      expectedRevision: 1,
      reason: 'Corrected transposition',
      games: [
        { playerOnePoints: 7, playerTwoPoints: 11 },
        { playerOnePoints: 9, playerTwoPoints: 11 },
      ],
    });

    expect(updates.find(({ table }) => table === tournamentFixtures)?.values).toEqual({
      playerOneId: 'player-2',
    });
    expect(tx.delete).toHaveBeenCalledWith(matchParticipants);
    expect(tx.insert).toHaveBeenCalledWith(matchParticipants);
  });

  it('does not append revision, audit, statistics, or events when progression update fails', async () => {
    locateManager();
    const { tx, writes } = successfulTransaction(
      {
        ...fixture,
        stage: 'knockout',
        tournamentStatus: 'knockout',
        groupId: null,
        matchStatus: 'completed',
        currentRevision: 1,
        currentWinnerId: 'player-1',
        completedAt: new Date(),
        advancesToFixtureId: 'next-fixture',
        advancesToPosition: 1,
      },
      undefined,
      {
        fixture: {
          id: 'next-fixture',
          matchId: 'next-match',
          playerOneId: 'player-1',
          playerTwoId: 'player-3',
        },
      },
    );
    const update = tx.update.getMockImplementation();
    tx.update.mockImplementation(((table: unknown) =>
      table === tournamentFixtures
        ? { set: () => ({ where: async () => Promise.reject(new Error('progression failed')) }) }
        : update!(table)) as never);

    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Correction',
        games: [
          { playerOnePoints: 7, playerTwoPoints: 11 },
          { playerOnePoints: 9, playerTwoPoints: 11 },
        ],
      }),
    ).rejects.toThrow('progression failed');
    expect(writes.some(({ table }) => table === matchResultRevisions)).toBe(false);
    expect(writes.some(({ table }) => table === auditLogs)).toBe(false);
    expect(tx.execute).not.toHaveBeenCalled();
    expect(writes.some(({ table }) => table === outboxEvents)).toBe(false);
  });

  it('rejects a Knockout correction after its dependent Match begins without writes', async () => {
    locateManager();
    const { tx } = successfulTransaction(
      {
        ...fixture,
        stage: 'knockout',
        tournamentStatus: 'knockout',
        groupId: null,
        matchStatus: 'completed',
        currentRevision: 1,
        currentWinnerId: 'player-1',
        completedAt: new Date(),
        advancesToFixtureId: 'next-fixture',
        advancesToPosition: 1,
      },
      undefined,
      {
        fixture: {
          id: 'next-fixture',
          matchId: 'next-match',
          playerOneId: 'player-1',
          playerTwoId: 'player-3',
        },
        matchStatus: 'in-progress',
      },
    );

    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Correction',
        games: input.games,
      }),
    ).rejects.toMatchObject({ code: 'OFFICIAL_RESULT_LOCKED' });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('rejects a Group correction once Knockout Stage begins', async () => {
    locateManager();
    const { tx } = successfulTransaction({
      ...fixture,
      tournamentStatus: 'knockout',
      matchStatus: 'completed',
      currentRevision: 1,
      currentWinnerId: 'player-1',
      completedAt: new Date(),
    });
    await expect(
      recordOfficialTournamentResult('organizer-id', 'tournament-id', 'fixture-id', {
        expectedRevision: 1,
        reason: 'Correction',
        games: input.games,
      }),
    ).rejects.toMatchObject({ code: 'OFFICIAL_RESULT_LOCKED' });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

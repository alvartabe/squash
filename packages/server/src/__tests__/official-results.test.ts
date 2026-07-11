import {
  auditLogs,
  matches,
  matchResultRevisions,
  matchSets,
  outboxEvents,
} from '@squash/db/schema';
import { getClubAuthorization } from '../authorization';
import { db } from '../database';
import { recordOfficialTournamentResult } from '../official-results';

jest.mock('../database', () => ({
  db: { select: jest.fn(), transaction: jest.fn() },
}));

jest.mock('../authorization', () => ({ getClubAuthorization: jest.fn() }));

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
  matchId: 'match-id',
  matchSource: 'tournament' as const,
  matchStatus: 'scheduled' as const,
  currentRevision: 0,
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
) {
  const writes: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const select = jest.fn().mockReturnValueOnce(queryRows([record]));
  if (appointmentRows) select.mockReturnValueOnce(queryRows(appointmentRows));
  select.mockReturnValueOnce(
    queryRows([
      { userId: 'player-1', position: 1 },
      { userId: 'player-2', position: 2 },
    ]),
  );
  const tx = {
    select,
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
        payload: { matchId: 'match-id', source: 'tournament' },
      },
      {
        topic: 'tournament.progress',
        aggregateId: 'match-id',
        payload: { matchId: 'match-id', tournamentId: 'tournament-id' },
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
          payload: { matchId: 'match-id', tournamentId: 'tournament-id' },
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
      'OFFICIAL_RESULT_NOT_RECORDABLE',
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
      'OFFICIAL_RESULT_EXISTS',
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
    ['incomplete', [{ playerOnePoints: 11, playerTwoPoints: 7 }], 'OFFICIAL_RESULT_INCOMPLETE'],
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
    ).rejects.toMatchObject({ code: 'OFFICIAL_RESULT_CONFLICT', status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

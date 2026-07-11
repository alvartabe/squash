import {
  matches,
  matchParticipants,
  tournamentEntryRequests,
  tournamentFixtures,
  tournamentGroupMembers,
  tournamentGroups,
  tournamentInvitations,
  tournamentParticipations,
  tournaments,
} from '@squash/db/schema';
import { getClubAuthorization } from '../authorization';
import { db } from '../database';
import { inspectTournamentProgression } from '../tournament-progression';
import {
  decideTournamentEntryRequest,
  directlyAddTournamentPlayer,
  getTournamentManagement,
  inviteTournamentPlayer,
  listDiscoverableTournaments,
  removeTournamentPlayer,
  requestTournamentEntry,
  respondToTournamentInvitation,
  startTournament,
  updateTournamentFixtureSchedule,
  withdrawTournamentParticipation,
} from '../tournaments';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  getClubAuthorization: jest.fn(),
}));

jest.mock('../tournament-progression', () => ({
  inspectTournamentProgression: jest.fn(),
  progressTournament: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };
const mockAuthorization = getClubAuthorization as jest.Mock;
const mockInspectProgression = inspectTournamentProgression as jest.Mock;

const tournament = {
  id: 'tournament-id',
  clubId: 'owning-club-id',
  name: 'Club Open',
  status: 'registration' as const,
  visibility: 'public' as const,
  startsAt: new Date('2026-08-01T15:00:00.000Z'),
  timeZone: 'America/Costa_Rica',
  draftDrawGeneratedAt: null,
};

describe('Official Tournament Player discovery through completion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps authorized completed Tournaments in the mobile list', async () => {
    mockDb.select.mockReturnValueOnce(selectRows([{ id: 'player-id' }]));
    mockDb.select.mockReturnValueOnce(selectRows([]));
    mockDb.select.mockReturnValueOnce(
      selectRows([
        {
          id: tournament.id,
          clubId: tournament.clubId,
          clubName: 'Central',
          name: tournament.name,
          visibility: 'club-only',
          status: 'completed',
          startsAt: tournament.startsAt,
          timeZone: tournament.timeZone,
          participantId: 'player-id',
          entryRequestId: null,
          invitationId: null,
        },
      ]),
    );

    await expect(listDiscoverableTournaments('player-id')).resolves.toEqual([
      expect.objectContaining({
        id: tournament.id,
        status: 'completed',
        relationship: 'accepted',
      }),
    ]);
  });
});

describe('Official Tournament Fixture Schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets an authorized Organizer configure an unstarted Match', async () => {
    mockAuthorization.mockResolvedValueOnce({
      platformRole: 'user',
      membershipStatus: 'active',
      responsibilities: ['owner'],
      clubArchivedAt: null,
    });
    const { updates } = transactionWith([
      [{ ...tournament, status: 'group-stage' }],
      [{ matchId: 'match-1', matchStatus: 'scheduled' }],
    ]);

    await expect(
      updateTournamentFixtureSchedule('owner-id', tournament.id, 'fixture-1', {
        scheduledAt: '2026-08-02T09:00:00-06:00',
        venueText: 'Glass Court',
        courtLabel: 'Court 1',
      }),
    ).resolves.toMatchObject({
      fixtureId: 'fixture-1',
      scheduledAt: '2026-08-02T15:00:00.000Z',
      venueText: 'Glass Court',
      courtLabel: 'Court 1',
    });
    expect(updates.find(({ table }) => table === matches)?.values).toMatchObject({
      scheduledAt: new Date('2026-08-02T15:00:00.000Z'),
      venueText: 'Glass Court',
      courtLabel: 'Court 1',
    });
  });

  it('locks Fixture Schedule changes after the Match begins', async () => {
    mockAuthorization.mockResolvedValueOnce({
      platformRole: 'user',
      membershipStatus: 'active',
      responsibilities: ['owner'],
      clubArchivedAt: null,
    });
    const { updates } = transactionWith([
      [{ ...tournament, status: 'knockout' }],
      [{ matchId: 'match-1', matchStatus: 'in-progress' }],
    ]);

    await expect(
      updateTournamentFixtureSchedule('owner-id', tournament.id, 'fixture-1', {
        scheduledAt: null,
        venueText: null,
        courtLabel: null,
      }),
    ).rejects.toMatchObject({ code: 'TOURNAMENT_FIXTURE_ALREADY_STARTED', status: 409 });
    expect(updates).toEqual([]);
  });
});

function selectRows(rows: unknown[]) {
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

function managerLocator() {
  mockDb.select.mockReturnValueOnce({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          limit: async () => [{ id: tournament.id, clubId: tournament.clubId, archivedAt: null }],
        }),
      }),
    }),
  });
  mockAuthorization.mockResolvedValueOnce({
    membershipStatus: 'active',
    responsibilities: ['owner'],
    clubArchivedAt: null,
  });
}

function queueSelectRows(selections: unknown[][]) {
  for (const rows of selections) mockDb.select.mockReturnValueOnce(selectRows(rows));
}

function transactionWith(
  selections: unknown[][],
  options: {
    inserted?: Partial<Record<'request' | 'invitation' | 'participation', unknown>>;
    deletedParticipation?: unknown;
  } = {},
) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const deletes: unknown[] = [];
  const select = jest.fn();
  for (const rows of selections) select.mockReturnValueOnce(selectRows(rows));
  const tx = {
    select,
    insert: jest.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        const result =
          table === tournamentEntryRequests
            ? options.inserted?.request
            : table === tournamentInvitations
              ? options.inserted?.invitation
              : options.inserted?.participation;
        return {
          returning: async () => (result ? [result] : []),
          onConflictDoNothing: () => ({
            returning: async () => (result ? [result] : []),
          }),
        };
      },
    })),
    update: jest.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          where: () => ({
            returning: async () => [{ ...values, id: 'resolved-id' }],
          }),
        };
      },
    })),
    delete: jest.fn((table: unknown) => {
      deletes.push(table);
      return {
        where: () => ({
          returning: async () =>
            options.deletedParticipation ? [options.deletedParticipation] : [],
        }),
      };
    }),
  };
  mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, inserts, updates, deletes };
}

function startTransactionWith(
  selections: unknown[][],
  matchIds = ['match-1', 'match-2', 'match-3'],
) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const select = jest.fn();
  const remainingMatchIds = [...matchIds];
  for (const rows of selections) select.mockReturnValueOnce(selectRows(rows));
  const tx = {
    select,
    insert: jest.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        return {
          returning: async () => [
            table === matches ? { id: remainingMatchIds.shift() ?? 'match-id' } : values,
          ],
        };
      },
    })),
    update: jest.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          where: () => ({
            returning: async () => [{ ...values, id: 'started-id' }],
          }),
        };
      },
    })),
  };
  mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, inserts, updates };
}

describe('Official Tournament Player participation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInspectProgression.mockResolvedValue({ status: 'inactive' });
  });

  it('allows a clubless or cross-Club Player to request a Public Tournament', async () => {
    const request = { id: 'request-id', tournamentId: tournament.id, playerId: 'player-id' };
    const { inserts } = transactionWith([[tournament], [{ id: 'player-id' }], [], [], [], []], {
      inserted: { request },
    });
    await expect(requestTournamentEntry('player-id', tournament.id)).resolves.toEqual(request);
    expect(inserts.find(({ table }) => table === tournamentEntryRequests)?.values).toEqual({
      tournamentId: tournament.id,
      playerId: 'player-id',
    });
  });

  it('rejects a non-member Entry Request for a Club-only Tournament', async () => {
    const { tx } = transactionWith([
      [{ ...tournament, visibility: 'club-only' }],
      [{ id: 'player-id' }],
      [],
    ]);
    await expect(requestTournamentEntry('player-id', tournament.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['accepted', [[{ playerId: 'player-id' }], [], []], 'TOURNAMENT_PARTICIPATION_EXISTS'],
    ['pending', [[], [{ id: 'request-id' }], []], 'TOURNAMENT_RELATIONSHIP_PENDING'],
  ] as const)(
    'returns a stable error for an already %s relationship',
    async (_state, rows, code) => {
      const { tx } = transactionWith([
        [tournament],
        [{ id: 'player-id' }],
        [],
        ...rows.map((row) => [...row]),
      ]);
      await expect(requestTournamentEntry('player-id', tournament.id)).rejects.toMatchObject({
        code,
        status: 409,
      });
      expect(tx.insert).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['approves', true, true],
    ['rejects', false, false],
  ] as const)('%s a pending Entry Request', async (_label, approve, createsParticipation) => {
    managerLocator();
    const request = {
      id: 'request-id',
      tournamentId: tournament.id,
      playerId: 'player-id',
      status: 'pending' as const,
    };
    const participation = { tournamentId: tournament.id, playerId: 'player-id' };
    const { inserts, deletes, updates } = transactionWith([[tournament], [request]], {
      inserted: { participation },
    });
    await decideTournamentEntryRequest('owner-id', tournament.id, request.id, approve);
    expect(mockDb.transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'serializable',
    });
    expect(inserts.some(({ table }) => table === tournamentParticipations)).toBe(
      createsParticipation,
    );
    expect(deletes.includes(tournamentGroups)).toBe(createsParticipation);
    expect(updates.find(({ table }) => table === tournamentEntryRequests)?.values.status).toBe(
      approve ? 'approved' : 'rejected',
    );
  });

  it('invites a registered Player outside the visibility audience', async () => {
    managerLocator();
    const invitation = { id: 'invitation-id', playerId: 'outside-player-id' };
    const { inserts } = transactionWith(
      [[{ ...tournament, visibility: 'club-only' }], [{ id: 'outside-player-id' }], [], [], []],
      { inserted: { invitation } },
    );
    await expect(
      inviteTournamentPlayer('owner-id', tournament.id, 'outside-player-id'),
    ).resolves.toEqual(invitation);
    expect(inserts.find(({ table }) => table === tournamentInvitations)?.values).toMatchObject({
      playerId: 'outside-player-id',
    });
  });

  it.each([
    ['accepts', true, true],
    ['rejects', false, false],
  ] as const)('%s a Tournament Invitation', async (_label, accept, createsParticipation) => {
    const invitation = {
      id: 'invitation-id',
      tournamentId: tournament.id,
      playerId: 'player-id',
      status: 'pending' as const,
    };
    const selections = accept ? [[tournament], [invitation], []] : [[tournament], [invitation]];
    const { inserts, deletes, updates } = transactionWith(selections, {
      inserted: {
        participation: { tournamentId: tournament.id, playerId: 'player-id' },
      },
    });
    await respondToTournamentInvitation('player-id', tournament.id, invitation.id, accept);
    expect(inserts.some(({ table }) => table === tournamentParticipations)).toBe(
      createsParticipation,
    );
    expect(deletes.includes(tournamentGroups)).toBe(createsParticipation);
    expect(updates.find(({ table }) => table === tournamentInvitations)?.values.status).toBe(
      accept ? 'accepted' : 'rejected',
    );
  });
});

describe('Official Tournament accepted-roster management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInspectProgression.mockResolvedValue({ status: 'inactive' });
  });

  it('directly adds any registered Player and invalidates the Draft Draw', async () => {
    managerLocator();
    const participation = { tournamentId: tournament.id, playerId: 'clubless-player-id' };
    const { inserts, deletes } = transactionWith(
      [[tournament], [{ id: 'clubless-player-id' }], [], [], []],
      { inserted: { participation } },
    );
    await directlyAddTournamentPlayer('owner-id', tournament.id, 'clubless-player-id');
    expect(inserts.some(({ table }) => table === tournamentParticipations)).toBe(true);
    expect(deletes).toContain(tournamentGroups);
  });

  it('allows withdrawal without rechecking Club Membership or visibility', async () => {
    const { deletes } = transactionWith([[{ ...tournament, visibility: 'club-only' }]], {
      deletedParticipation: { playerId: 'player-id' },
    });
    await expect(
      withdrawTournamentParticipation('player-id', tournament.id),
    ).resolves.toMatchObject({ withdrawn: true });
    expect(deletes).toContain(tournamentParticipations);
    expect(deletes).toContain(tournamentGroups);
  });

  it('allows an organizer to remove an accepted Player before Start', async () => {
    managerLocator();
    const { deletes } = transactionWith([[tournament]], {
      deletedParticipation: { playerId: 'player-id' },
    });
    await expect(
      removeTournamentPlayer('owner-id', tournament.id, 'player-id'),
    ).resolves.toMatchObject({ removed: true });
    expect(deletes).toContain(tournamentGroups);
  });

  it.each([
    ['player withdrawal', () => withdrawTournamentParticipation('player-id', tournament.id)],
    [
      'organizer removal',
      () => {
        managerLocator();
        return removeTournamentPlayer('owner-id', tournament.id, 'player-id');
      },
    ],
  ])('rejects %s once Tournament Start has locked the roster', async (_label, mutation) => {
    const { tx } = transactionWith([[{ ...tournament, status: 'group-stage' }]]);
    await expect(mutation()).rejects.toMatchObject({
      code: 'TOURNAMENT_ROSTER_LOCKED',
      status: 409,
    });
    expect(tx.delete).not.toHaveBeenCalled();
  });
});

describe('Official Tournament Start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInspectProgression.mockResolvedValue({ status: 'inactive' });
  });

  const startReadyTournament = {
    ...tournament,
    draftDrawGeneratedAt: new Date('2026-08-01T15:00:00.000Z'),
    qualifiersPerGroup: 2,
    rulesId: 'rules-id',
  };

  it('requires a generated Draft Draw before Start', async () => {
    managerLocator();
    const { tx } = startTransactionWith([
      [{ ...startReadyTournament, draftDrawGeneratedAt: null }],
    ]);

    await expect(startTournament('owner-id', tournament.id)).rejects.toMatchObject({
      code: 'TOURNAMENT_DRAFT_DRAW_REQUIRED',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('requires at least three accepted Players at Start', async () => {
    managerLocator();
    const { tx } = startTransactionWith([
      [startReadyTournament],
      [{ playerId: 'player-1' }, { playerId: 'player-2' }],
    ]);

    await expect(startTournament('owner-id', tournament.id)).rejects.toMatchObject({
      code: 'TOURNAMENT_START_REQUIRES_THREE_PLAYERS',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('rejects a stale Draft Draw when the accepted roster changed', async () => {
    managerLocator();
    const { tx } = startTransactionWith([
      [startReadyTournament],
      [{ playerId: 'player-1' }, { playerId: 'player-2' }, { playerId: 'player-3' }],
      [{ id: 'group-1', position: 1 }],
      [
        { groupId: 'group-1', playerId: 'player-1', seed: null },
        { groupId: 'group-1', playerId: 'player-2', seed: null },
      ],
    ]);

    await expect(startTournament('owner-id', tournament.id)).rejects.toMatchObject({
      code: 'TOURNAMENT_DRAFT_DRAW_STALE',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('creates Group Stage fixtures and locks the Tournament in Group Stage', async () => {
    managerLocator();
    const { inserts, updates } = startTransactionWith([
      [startReadyTournament],
      [{ playerId: 'player-1' }, { playerId: 'player-2' }, { playerId: 'player-3' }],
      [{ id: 'group-1', position: 1 }],
      [
        { groupId: 'group-1', playerId: 'player-1', seed: 1 },
        { groupId: 'group-1', playerId: 'player-2', seed: 2 },
        { groupId: 'group-1', playerId: 'player-3', seed: 3 },
      ],
    ]);

    await expect(startTournament('owner-id', tournament.id)).resolves.toMatchObject({
      status: 'group-stage',
      players: 3,
      groups: 1,
      fixtures: 3,
    });
    expect(inserts.filter(({ table }) => table === matches)).toHaveLength(3);
    expect(inserts.filter(({ table }) => table === matchParticipants)).toHaveLength(3);
    expect(inserts.filter(({ table }) => table === tournamentFixtures)).toHaveLength(3);
    expect(inserts.some(({ table }) => table === tournamentGroups)).toBe(false);
    expect(inserts.some(({ table }) => table === tournamentGroupMembers)).toBe(false);
    expect(updates.find(({ table }) => table === tournaments)?.values.status).toBe('group-stage');
  });

  it('creates unique Group Stage fixture positions across multiple Groups', async () => {
    managerLocator();
    const { inserts } = startTransactionWith(
      [
        [startReadyTournament],
        [
          { playerId: 'player-1' },
          { playerId: 'player-2' },
          { playerId: 'player-3' },
          { playerId: 'player-4' },
          { playerId: 'player-5' },
          { playerId: 'player-6' },
        ],
        [
          { id: 'group-1', position: 1 },
          { id: 'group-2', position: 2 },
        ],
        [
          { groupId: 'group-1', playerId: 'player-1', seed: 1 },
          { groupId: 'group-1', playerId: 'player-2', seed: 2 },
          { groupId: 'group-1', playerId: 'player-3', seed: 3 },
          { groupId: 'group-2', playerId: 'player-4', seed: 4 },
          { groupId: 'group-2', playerId: 'player-5', seed: 5 },
          { groupId: 'group-2', playerId: 'player-6', seed: 6 },
        ],
      ],
      ['match-1', 'match-2', 'match-3', 'match-4', 'match-5', 'match-6'],
    );

    await expect(startTournament('owner-id', tournament.id)).resolves.toMatchObject({
      status: 'group-stage',
      players: 6,
      groups: 2,
      fixtures: 6,
    });

    const fixtureRows = inserts
      .filter(({ table }) => table === tournamentFixtures)
      .map(({ values }) => values as { groupId: string; round: number; position: number });
    expect(fixtureRows).toHaveLength(6);
    expect(fixtureRows.filter((fixture) => fixture.groupId === 'group-1')).toHaveLength(3);
    expect(fixtureRows.filter((fixture) => fixture.groupId === 'group-2')).toHaveLength(3);
    expect(new Set(fixtureRows.map((fixture) => `${fixture.round}:${fixture.position}`)).size).toBe(
      fixtureRows.length,
    );
  });
});

describe('Official Tournament management fixture read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockAuthorization.mockReset();
    mockInspectProgression.mockReset();
    mockInspectProgression.mockResolvedValue({ status: 'inactive' });
  });

  const startedTournament = {
    ...tournament,
    description: 'Costa Rica championship event.',
    venue: 'Central Squash Club',
    status: 'group-stage' as const,
    draftDrawGeneratedAt: new Date('2026-08-01T15:00:00.000Z'),
  };

  const fixtureRows = [
    {
      id: 'fixture-3',
      matchId: 'match-3',
      matchStatus: 'completed' as const,
      currentRevision: 1,
      winnerId: 'player-4',
      groupId: 'group-2',
      groupName: 'B',
      groupPosition: 2,
      round: 1,
      position: 2,
      playerOneId: 'player-4',
      playerOneName: 'Diego Arias',
      playerOneImage: 'https://example.test/diego.png',
      playerTwoId: 'player-5',
      playerTwoName: 'Elena Mora',
      playerTwoImage: null,
      bestOf: 3,
      pointsToWin: 11,
      winByTwo: true,
    },
    {
      id: 'fixture-2',
      matchId: 'match-2',
      matchStatus: 'in-progress' as const,
      currentRevision: 0,
      winnerId: null,
      groupId: 'group-1',
      groupName: 'A',
      groupPosition: 1,
      round: 2,
      position: 3,
      playerOneId: 'player-1',
      playerOneName: 'Ana Vega',
      playerOneImage: null,
      playerTwoId: 'player-3',
      playerTwoName: 'Camila Solano',
      playerTwoImage: 'https://example.test/camila.png',
      bestOf: 3,
      pointsToWin: 11,
      winByTwo: true,
    },
    {
      id: 'fixture-1',
      matchId: 'match-1',
      matchStatus: 'scheduled' as const,
      currentRevision: 0,
      winnerId: null,
      groupId: 'group-1',
      groupName: 'A',
      groupPosition: 1,
      round: 1,
      position: 1,
      playerOneId: 'player-1',
      playerOneName: 'Ana Vega',
      playerOneImage: null,
      playerTwoId: 'player-2',
      playerTwoName: 'Bruno Castro',
      playerTwoImage: 'https://example.test/bruno.png',
      bestOf: 3,
      pointsToWin: 11,
      winByTwo: true,
    },
  ];

  function queueManagementPayload(fixtures: unknown[] = fixtureRows) {
    queueSelectRows([
      [startedTournament],
      [],
      [],
      [],
      [{ bestOf: 3, pointsToWin: 11, winByTwo: true }],
      fixtures,
      [],
    ]);
  }

  it('returns finalized Group Stage fixtures with Player names for authorized managers', async () => {
    managerLocator();
    queueManagementPayload();

    const result = await getTournamentManagement('owner-id', tournament.id);

    expect(result.groupFixtures).toHaveLength(3);
    expect(result.groupFixtures.map((fixture) => fixture.id)).toEqual([
      'fixture-1',
      'fixture-2',
      'fixture-3',
    ]);
    expect(
      result.groupFixtures.map((fixture) => ({
        groupPosition: fixture.groupPosition,
        round: fixture.round,
        position: fixture.position,
        matchStatus: fixture.matchStatus,
        mayRecord: fixture.mayRecordInitialOfficialResult,
        players: [fixture.playerOne.name, fixture.playerTwo.name],
        playerImages: [fixture.playerOne.image, fixture.playerTwo.image],
      })),
    ).toEqual([
      {
        groupPosition: 1,
        round: 1,
        position: 1,
        matchStatus: 'scheduled',
        mayRecord: true,
        players: ['Ana Vega', 'Bruno Castro'],
        playerImages: [null, 'https://example.test/bruno.png'],
      },
      {
        groupPosition: 1,
        round: 2,
        position: 3,
        matchStatus: 'in-progress',
        mayRecord: false,
        players: ['Ana Vega', 'Camila Solano'],
        playerImages: [null, 'https://example.test/camila.png'],
      },
      {
        groupPosition: 2,
        round: 1,
        position: 2,
        matchStatus: 'completed',
        mayRecord: false,
        players: ['Diego Arias', 'Elena Mora'],
        playerImages: ['https://example.test/diego.png', null],
      },
    ]);
  });

  it('rejects Coach fixture reads without an explicit Tournament Organizer appointment', async () => {
    mockDb.select.mockReturnValueOnce(
      selectRows([{ id: tournament.id, clubId: tournament.clubId, archivedAt: null }]),
    );
    mockAuthorization.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: ['coach'],
      clubArchivedAt: null,
    });
    mockDb.select.mockReturnValueOnce(selectRows([]));

    await expect(getTournamentManagement('coach-id', tournament.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('allows an appointed Coach to read finalized Group Stage fixtures', async () => {
    mockDb.select.mockReturnValueOnce(
      selectRows([{ id: tournament.id, clubId: tournament.clubId, archivedAt: null }]),
    );
    mockAuthorization.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: ['coach'],
      clubArchivedAt: null,
    });
    mockDb.select.mockReturnValueOnce(selectRows([{ userId: 'coach-id' }]));
    queueManagementPayload([fixtureRows[0]]);

    await expect(getTournamentManagement('coach-id', tournament.id)).resolves.toMatchObject({
      groupFixtures: [
        {
          id: 'fixture-3',
          groupName: 'B',
          matchStatus: 'completed',
          playerOne: { name: 'Diego Arias', image: 'https://example.test/diego.png' },
          playerTwo: { name: 'Elena Mora', image: null },
        },
      ],
    });
  });

  it('serializes available and completed Knockout fixtures with scoring and Official Results', async () => {
    managerLocator();
    queueSelectRows([
      [{ ...startedTournament, status: 'knockout' as const }],
      [],
      [],
      [],
      [{ bestOf: 5, pointsToWin: 11, winByTwo: true }],
      [],
      [
        {
          id: 'knockout-1',
          matchId: 'knockout-match-1',
          matchStatus: 'completed',
          currentRevision: 1,
          winnerId: 'player-1',
          round: 1,
          position: 1,
          playerOneId: 'player-1',
          playerOneName: 'Ana Vega',
          playerOneImage: null,
          playerTwoId: 'player-2',
          playerTwoName: 'Bruno Castro',
          playerTwoImage: null,
        },
        {
          id: 'knockout-2',
          matchId: 'knockout-match-2',
          matchStatus: 'scheduled',
          currentRevision: 0,
          winnerId: null,
          round: 1,
          position: 2,
          playerOneId: 'player-3',
          playerOneName: 'Camila Solano',
          playerOneImage: null,
          playerTwoId: 'player-4',
          playerTwoName: 'Diego Arias',
          playerTwoImage: null,
        },
      ],
      [
        {
          matchId: 'knockout-match-1',
          gameNumber: 1,
          playerOnePoints: 11,
          playerTwoPoints: 8,
        },
        {
          matchId: 'knockout-match-1',
          gameNumber: 2,
          playerOnePoints: 11,
          playerTwoPoints: 9,
        },
        {
          matchId: 'knockout-match-1',
          gameNumber: 3,
          playerOnePoints: 11,
          playerTwoPoints: 6,
        },
      ],
    ]);

    await expect(getTournamentManagement('owner-id', tournament.id)).resolves.toMatchObject({
      description: startedTournament.description,
      venue: startedTournament.venue,
      knockoutFixtures: [
        {
          id: 'knockout-1',
          stage: 'knockout',
          scoringRules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
          games: [
            { playerOnePoints: 11, playerTwoPoints: 8 },
            { playerOnePoints: 11, playerTwoPoints: 9 },
            { playerOnePoints: 11, playerTwoPoints: 6 },
          ],
          winnerId: 'player-1',
          mayRecordInitialOfficialResult: false,
          mayBeginMatch: false,
        },
        {
          id: 'knockout-2',
          stage: 'knockout',
          games: [],
          mayRecordInitialOfficialResult: false,
          mayBeginMatch: true,
        },
      ],
    });
  });

  it('exposes the unresolved tie context and only its tied Players', async () => {
    managerLocator();
    queueManagementPayload();
    mockInspectProgression.mockResolvedValueOnce({
      status: 'manual-tiebreak-required',
      requirement: {
        tournamentId: tournament.id,
        context: 'group-standings',
        groupId: 'group-1',
        playerIds: ['player-3', 'player-1'],
        requirementKey: 'a'.repeat(64),
      },
    });
    queueSelectRows([
      [
        { id: 'player-1', name: 'Ana Vega', image: null },
        { id: 'player-3', name: 'Camila Solano', image: 'https://example.test/camila.png' },
      ],
    ]);

    await expect(getTournamentManagement('owner-id', tournament.id)).resolves.toMatchObject({
      organizerTiebreakRequirement: {
        context: 'group-standings',
        group: { id: 'group-1', name: 'A' },
        players: [
          {
            id: 'player-3',
            name: 'Camila Solano',
            image: 'https://example.test/camila.png',
          },
          { id: 'player-1', name: 'Ana Vega', image: null },
        ],
        requirementKey: 'a'.repeat(64),
      },
    });
  });
});

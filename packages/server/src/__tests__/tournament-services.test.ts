import {
  tournamentEntryRequests,
  tournamentGroups,
  tournamentInvitations,
  tournamentParticipations,
} from '@squash/db/schema';
import { getClubAuthorization } from '../authorization';
import { db } from '../database';
import {
  decideTournamentEntryRequest,
  directlyAddTournamentPlayer,
  inviteTournamentPlayer,
  removeTournamentPlayer,
  requestTournamentEntry,
  respondToTournamentInvitation,
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

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };
const mockAuthorization = getClubAuthorization as jest.Mock;

const tournament = {
  id: 'tournament-id',
  clubId: 'owning-club-id',
  status: 'registration' as const,
  visibility: 'public' as const,
};

function selectRows(rows: unknown[]) {
  const query = {
    where: () => ({
      limit: () => ({
        for: async () => rows,
        then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
      }),
    }),
  };
  return { from: () => query };
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

describe('Official Tournament Player participation', () => {
  beforeEach(() => jest.clearAllMocks());

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
  beforeEach(() => jest.clearAllMocks());

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

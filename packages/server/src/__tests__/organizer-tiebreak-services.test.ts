import { auditLogs, organizerTiebreakDecisions, outboxEvents } from '@squash/db/schema';
import { getClubAuthorization } from '../authorization';
import { db } from '../database';
import { inspectTournamentProgression, progressTournament } from '../services';
import { submitOrganizerTiebreakDecision } from '../tournaments';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  getClubAuthorization: jest.fn(),
}));

jest.mock('../services', () => ({
  inspectTournamentProgression: jest.fn(),
  progressTournament: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };
const mockAuthorization = getClubAuthorization as jest.Mock;
const mockInspect = inspectTournamentProgression as jest.Mock;
const mockProgress = progressTournament as jest.Mock;

const requirement = {
  tournamentId: 'tournament-id',
  context: 'group-standings' as const,
  groupId: 'group-id',
  playerIds: ['player-1', 'player-2', 'player-3'],
  requirementKey: 'a'.repeat(64),
};

function selectRows(rows: unknown[]) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    limit: async () => rows,
  };
  return query;
}

function locateTournament() {
  mockDb.select.mockReturnValueOnce(
    selectRows([{ id: 'tournament-id', clubId: 'club-id', archivedAt: null }]),
  );
}

function authorizeOwner() {
  locateTournament();
  mockAuthorization.mockResolvedValueOnce({
    membershipStatus: 'active',
    responsibilities: ['owner'],
  });
}

describe('Organizer Tiebreak Decision service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInspect.mockResolvedValue({ status: 'manual-tiebreak-required', requirement });
    mockProgress.mockResolvedValue({ progressed: true, qualifiers: 4, rounds: 2 });
  });

  it('requires current Tournament Organizer authority', async () => {
    locateTournament();
    mockAuthorization.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: [],
    });

    await expect(
      submitOrganizerTiebreakDecision('player-id', 'tournament-id', {
        requirementKey: requirement.requirementKey,
        orderedPlayerIds: ['player-1', 'player-2', 'player-3'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('persists the exact order and deciding organizer, audits it, and resumes progression', async () => {
    authorizeOwner();
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const decidedAt = new Date('2026-07-10T18:00:00.000Z');
    const tx = {
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return {
            returning: async () =>
              table === organizerTiebreakDecisions
                ? [{ id: 'decision-id', ...(values as object), decidedAt }]
                : [],
          };
        },
      })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(
      submitOrganizerTiebreakDecision('owner-id', 'tournament-id', {
        requirementKey: requirement.requirementKey,
        orderedPlayerIds: ['player-3', 'player-1', 'player-2'],
      }),
    ).resolves.toMatchObject({
      decision: {
        id: 'decision-id',
        context: 'group-standings',
        orderedPlayerIds: ['player-3', 'player-1', 'player-2'],
        decidedById: 'owner-id',
        decidedAt: decidedAt.toISOString(),
      },
      progression: { progressed: true },
    });

    expect(inserts.find(({ table }) => table === organizerTiebreakDecisions)?.values).toMatchObject(
      {
        tournamentId: 'tournament-id',
        context: 'group-standings',
        groupId: 'group-id',
        orderedPlayerIds: ['player-3', 'player-1', 'player-2'],
        requirementKey: requirement.requirementKey,
        decidedById: 'owner-id',
      },
    );
    expect(inserts.find(({ table }) => table === auditLogs)?.values).toMatchObject({
      actorId: 'owner-id',
      clubId: 'club-id',
      action: 'tournament.organizer-tiebreak-decide',
      entityType: 'organizer-tiebreak-decision',
      entityId: 'decision-id',
    });
    expect(inserts.find(({ table }) => table === outboxEvents)?.values).toEqual({
      topic: 'tournament.progress',
      aggregateId: 'decision-id',
      payload: { tournamentId: 'tournament-id' },
    });
    expect(mockProgress).toHaveBeenCalledWith('tournament-id');
  });

  it.each([
    ['incomplete', ['player-1', 'player-2']],
    ['duplicate', ['player-1', 'player-1', 'player-3']],
    ['unrelated', ['player-1', 'player-2', 'outside-player']],
  ])('rejects an %s Player ordering', async (_label, orderedPlayerIds) => {
    authorizeOwner();
    await expect(
      submitOrganizerTiebreakDecision('owner-id', 'tournament-id', {
        requirementKey: requirement.requirementKey,
        orderedPlayerIds,
      }),
    ).rejects.toMatchObject({ code: 'ORGANIZER_TIEBREAK_ORDER_INVALID', status: 400 });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it.each([
    [
      'changed requirement',
      {
        status: 'manual-tiebreak-required',
        requirement: { ...requirement, requirementKey: 'b'.repeat(64) },
      },
    ],
    ['progressed Tournament', { status: 'inactive' }],
  ])('rejects a stale decision for a %s', async (_label, state) => {
    authorizeOwner();
    mockInspect.mockResolvedValueOnce(state);
    await expect(
      submitOrganizerTiebreakDecision('owner-id', 'tournament-id', {
        requirementKey: requirement.requirementKey,
        orderedPlayerIds: ['player-1', 'player-2', 'player-3'],
      }),
    ).rejects.toMatchObject({ code: 'ORGANIZER_TIEBREAK_STALE', status: 409 });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rejects a decision when progression changes between preflight and persistence', async () => {
    authorizeOwner();
    mockInspect
      .mockResolvedValueOnce({ status: 'manual-tiebreak-required', requirement })
      .mockResolvedValueOnce({ status: 'inactive' });
    const tx = { insert: jest.fn(), select: jest.fn() };
    mockDb.transaction.mockImplementationOnce(async (callback: (database: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(
      submitOrganizerTiebreakDecision('owner-id', 'tournament-id', {
        requirementKey: requirement.requirementKey,
        orderedPlayerIds: ['player-1', 'player-2', 'player-3'],
      }),
    ).rejects.toMatchObject({ code: 'ORGANIZER_TIEBREAK_STALE', status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

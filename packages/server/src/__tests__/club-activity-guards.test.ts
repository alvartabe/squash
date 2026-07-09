import {
  getClubAuthorization,
  requireLockedActiveClubMembership,
  requireLockedClubAction,
} from '../authorization';
import { clubPlaySessionParticipants, clubPlaySessions } from '@squash/db/schema';
import { db } from '../database';
import { ServiceError } from '../errors';
import {
  createClubPlaySession,
  setClubPlaySessionAttendance,
  updateClubPlaySession,
} from '../club-play-sessions';
import { createTournament, generateTournamentDraftDraw } from '../tournaments';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  getClubAuthorization: jest.fn(),
  requireActiveClubMembership: jest.fn(),
  requireClubAction: jest.fn(),
  requireLockedActiveClubMembership: jest.fn(),
  requireLockedClubAction: jest.fn(),
  requirePlatformAdmin: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };
const mockRequireLockedClubAction = requireLockedClubAction as jest.Mock;
const mockRequireLockedActiveClubMembership = requireLockedActiveClubMembership as jest.Mock;
const mockGetClubAuthorization = getClubAuthorization as jest.Mock;

describe('archived Club activity guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();
    mockRequireLockedClubAction.mockReset();
    mockRequireLockedActiveClubMembership.mockReset();
    mockRequireLockedClubAction.mockRejectedValue(
      new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409),
    );
  });

  function topLevelSelectOne(row: unknown) {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => (row ? [row] : []),
          }),
        }),
        where: () => ({ limit: async () => (row ? [row] : []) }),
      }),
    });
  }

  function transaction() {
    const tx = { insert: jest.fn() };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );
    return tx;
  }

  it('rejects a new Club Play Session before inserting any activity', async () => {
    const tx = transaction();

    await expect(
      createClubPlaySession('coach-id', {
        clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
        title: 'Saturday play',
        startsAtLocal: '2099-07-11T09:00',
        endsAtLocal: '2099-07-11T11:00',
      }),
    ).rejects.toMatchObject({ code: 'CLUB_ARCHIVED', status: 409 });
    expect(mockRequireLockedClubAction).toHaveBeenCalledWith(
      tx,
      'coach-id',
      'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
      'session.create',
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('revalidates the future start after waiting for the Club lock', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2099-07-11T15:00:30.000Z'));
      const tx = transaction();
      mockRequireLockedClubAction.mockImplementationOnce(async () => {
        jest.setSystemTime(new Date('2099-07-11T15:01:00.000Z'));
        return {
          membershipStatus: 'active',
          responsibilities: ['coach'],
          clubArchivedAt: null,
        };
      });

      await expect(
        createClubPlaySession('coach-id', {
          clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
          title: 'Too late after lock',
          startsAtLocal: '2099-07-11T09:01',
          endsAtLocal: '2099-07-11T10:01',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_SESSION_TIME', status: 400 });
      expect(tx.insert).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a new Official Tournament before inserting rules or activity', async () => {
    mockGetClubAuthorization.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: ['owner'],
      clubArchivedAt: new Date(),
    });
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({ for: async () => [{ id: 'club-id' }] }),
          }),
        }),
      })),
      insert: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      createTournament('owner-id', {
        clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
        name: 'Club Championship',
        visibility: 'club-only',
        startsAt: '2026-08-01T09:00:00.000-06:00',
        timeZone: 'America/Costa_Rica',
        groupSize: 4,
        qualifiersPerGroup: 2,
        seedingMethod: 'manual',
        rules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
      }),
    ).rejects.toMatchObject({ code: 'CLUB_ARCHIVED', status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('does not accept Attendance Responses for a Session cancelled by archival after restoration', async () => {
    topLevelSelectOne({ clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc' });
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [
                {
                  id: 'session-id',
                  clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
                  startsAt: new Date('2099-07-11T15:00:00.000Z'),
                  cancelledAt: new Date(),
                },
              ],
            }),
          }),
        }),
      })),
      insert: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      setClubPlaySessionAttendance('coach-id', 'session-id', {
        response: 'going',
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({
      code: 'SESSION_CANCELLED',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('does not regenerate a Tournament cancelled by archival after restoration', async () => {
    const clubId = 'bd8749bd-8b32-4fd2-a96e-5413de2057cc';
    topLevelSelectOne({ clubId });
    mockGetClubAuthorization.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: ['owner'],
      clubArchivedAt: null,
    });
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [
                {
                  id: 'tournament-id',
                  clubId,
                  status: 'cancelled',
                  seedingMethod: 'manual',
                  groupSize: 4,
                },
              ],
            }),
          }),
        }),
      })),
      insert: jest.fn(),
      update: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(generateTournamentDraftDraw('owner-id', 'tournament-id')).rejects.toMatchObject({
      code: 'TOURNAMENT_REGISTRATION_NOT_OPEN',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects a stale Session update while holding the Session lock', async () => {
    const clubId = 'bd8749bd-8b32-4fd2-a96e-5413de2057cc';
    topLevelSelectOne({ clubId });
    mockRequireLockedClubAction.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: ['coach'],
      clubArchivedAt: null,
    });
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [
                {
                  id: 'session-id',
                  clubId,
                  coordinatorId: 'coach-id',
                  version: 2,
                  startsAt: new Date('2099-07-11T15:00:00.000Z'),
                  endsAt: new Date('2099-07-11T17:00:00.000Z'),
                  cancelledAt: null,
                },
              ],
            }),
          }),
        }),
      })),
      update: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubPlaySession('coach-id', 'session-id', {
        expectedVersion: 1,
        title: 'Stale title',
      }),
    ).rejects.toMatchObject({ code: 'STALE_SESSION', status: 409 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('clears other participant responses when the Session schedule changes', async () => {
    const clubId = 'bd8749bd-8b32-4fd2-a96e-5413de2057cc';
    topLevelSelectOne({ clubId });
    mockRequireLockedClubAction.mockResolvedValueOnce({
      membershipStatus: 'active',
      responsibilities: ['coach'],
      clubArchivedAt: null,
    });
    const current = {
      id: 'session-id',
      clubId,
      coordinatorId: 'coach-id',
      title: 'Saturday play',
      notes: null,
      version: 2,
      startsAt: new Date('2099-07-11T15:00:00.000Z'),
      endsAt: new Date('2099-07-11T17:00:00.000Z'),
      cancelledAt: null,
    };
    const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [current],
            }),
          }),
        }),
      })),
      update: jest.fn((table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            updates.push({ table, values });
            if (table === clubPlaySessions) {
              return {
                returning: async () => [
                  {
                    ...current,
                    startsAt: new Date('2099-07-12T15:00:00.000Z'),
                    endsAt: new Date('2099-07-12T17:00:00.000Z'),
                    version: 3,
                  },
                ],
              };
            }
            return Promise.resolve([]);
          },
        }),
      })),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubPlaySession('coach-id', 'session-id', {
        expectedVersion: 2,
        startsAtLocal: '2099-07-12T09:00',
        endsAtLocal: '2099-07-12T11:00',
      }),
    ).resolves.toMatchObject({ version: 3 });
    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({
      table: clubPlaySessionParticipants,
      values: {
        response: null,
        version: expect.anything(),
        updatedAt: expect.any(Date),
      },
    });
  });

  it('rejects Attendance Responses when the Player is no longer an Active Club Member', async () => {
    topLevelSelectOne({ clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc' });
    mockRequireLockedActiveClubMembership.mockRejectedValueOnce(
      new ServiceError('FORBIDDEN', 'error.forbidden', 403),
    );
    const tx = { select: jest.fn(), insert: jest.fn(), update: jest.fn() };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      setClubPlaySessionAttendance('player-id', 'session-id', {
        response: 'not-going',
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(tx.select).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

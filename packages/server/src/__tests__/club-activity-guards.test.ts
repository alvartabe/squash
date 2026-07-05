import { requireLockedClubAction } from '../authorization';
import { db } from '../database';
import { ServiceError } from '../errors';
import {
  createOpenPlay,
  createTournament,
  generateTournamentGroups,
  setOpenPlayAttendance,
} from '../services';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireActiveClubMembership: jest.fn(),
  requireClubAction: jest.fn(),
  requireLockedActiveClubMembership: jest.fn(),
  requireLockedClubAction: jest.fn(),
  requirePlatformAdmin: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };
const mockRequireLockedClubAction = requireLockedClubAction as jest.Mock;

describe('archived Club activity guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();
    mockRequireLockedClubAction.mockReset();
    mockRequireLockedClubAction.mockRejectedValue(
      new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409),
    );
  });

  function topLevelSelectOne(row: unknown) {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => (row ? [row] : []),
        }),
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
      createOpenPlay('coach-id', {
        clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
        title: 'Saturday play',
        startsAt: '2026-07-11T15:00:00.000-06:00',
        endsAt: '2026-07-11T17:00:00.000-06:00',
        timeZone: 'America/Costa_Rica',
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

  it('rejects a new Official Tournament before inserting rules or activity', async () => {
    const tx = transaction();

    await expect(
      createTournament('owner-id', {
        clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
        name: 'Club Championship',
        startsAt: '2026-08-01T09:00:00.000-06:00',
        registrationClosesAt: '2026-07-30T18:00:00.000-06:00',
        timeZone: 'America/Costa_Rica',
        groupSize: 4,
        qualifiersPerGroup: 2,
        seedingMethod: 'manual',
        rules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
      }),
    ).rejects.toMatchObject({ code: 'CLUB_ARCHIVED', status: 409 });
    expect(mockRequireLockedClubAction).toHaveBeenCalledWith(
      tx,
      'owner-id',
      'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
      'tournament.manage',
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('does not accept Attendance Responses for a Session cancelled by archival after restoration', async () => {
    topLevelSelectOne({ clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc' });
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
              for: async () => [{ id: 'session-id', cancelledAt: new Date() }],
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
      setOpenPlayAttendance('coach-id', 'session-id', 'accepted'),
    ).rejects.toMatchObject({
      code: 'SESSION_CANCELLED',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('does not regenerate a Tournament cancelled by archival after restoration', async () => {
    const clubId = 'bd8749bd-8b32-4fd2-a96e-5413de2057cc';
    topLevelSelectOne({ clubId });
    mockRequireLockedClubAction.mockResolvedValueOnce({
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

    await expect(generateTournamentGroups('owner-id', 'tournament-id')).rejects.toMatchObject({
      code: 'TOURNAMENT_ALREADY_STARTED',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});

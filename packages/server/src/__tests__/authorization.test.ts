import { db } from '../database';
import { requireClubAction, requirePlatformAdmin } from '../authorization';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
  },
}));

const mockDb = db as unknown as { select: jest.Mock };

function mockAuthorization(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result ? [result] : []);
  const where = jest.fn(() => ({ limit }));
  const secondJoin = { where };
  const firstJoin = { leftJoin: jest.fn(() => secondJoin) };
  const from = jest.fn(() => ({ leftJoin: jest.fn(() => firstJoin) }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockPlatformRole(role: 'user' | 'platform-admin' | null) {
  const limit = jest.fn().mockResolvedValue(role ? [{ role }] : []);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

describe('platform authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('authorizes a Platform Administrator', async () => {
    mockPlatformRole('platform-admin');

    await expect(requirePlatformAdmin('platform-admin-id')).resolves.toEqual({
      role: 'platform-admin',
    });
  });

  it.each(['user', null] as const)('rejects a non-administrator role of %s', async (role) => {
    mockPlatformRole(role);

    await expect(requirePlatformAdmin('actor-id')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});

describe('club action authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects mutations against an archived club', async () => {
    mockAuthorization({
      platformRole: 'user',
      membershipStatus: 'active',
      responsibilities: ['owner'],
      clubId: 'club-id',
      clubArchivedAt: new Date(),
    });

    await expect(requireClubAction('owner-id', 'club-id', 'club.archive')).rejects.toMatchObject({
      code: 'CLUB_ARCHIVED',
      status: 409,
    });
  });

  it('continues to authorize actions against an active club', async () => {
    const authorization = {
      platformRole: 'user' as const,
      membershipStatus: 'active' as const,
      responsibilities: ['owner'] as const,
      clubId: 'club-id',
      clubArchivedAt: null,
    };
    mockAuthorization(authorization);

    await expect(requireClubAction('owner-id', 'club-id', 'club.archive')).resolves.toEqual(
      authorization,
    );
  });

  it.each(['suspended', 'ended'] as const)(
    'denies actions for a %s membership while preserving its responsibilities',
    async (membershipStatus) => {
      mockAuthorization({
        platformRole: 'user',
        membershipStatus,
        responsibilities: ['owner', 'admin', 'coach'],
        clubId: 'club-id',
        clubArchivedAt: null,
      });

      await expect(requireClubAction('member-id', 'club-id', 'club.archive')).rejects.toMatchObject(
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    },
  );
});

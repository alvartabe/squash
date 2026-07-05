import { db } from '../database';
import {
  requireClubAction,
  requireMembershipRequestReviewer,
  requirePlatformAdmin,
  requireRegisteredPlayer,
} from '../authorization';

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

describe('Player authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows any registered Player without requiring a Club relationship', async () => {
    const player = { id: 'player-id', email: 'player@example.com' };
    const limit = jest.fn().mockResolvedValue([player]);
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({ limit }),
      }),
    });

    await expect(requireRegisteredPlayer('player-id')).resolves.toEqual(player);
  });

  it('rejects an actor who is not a registered Player', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({ limit }),
      }),
    });

    await expect(requireRegisteredPlayer('missing-player-id')).rejects.toMatchObject({
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

  it('does not grant routine archival authority to a Platform Administrator', async () => {
    mockAuthorization({
      platformRole: 'platform-admin',
      membershipStatus: null,
      responsibilities: [],
      clubId: 'club-id',
      clubArchivedAt: null,
    });

    await expect(
      requireClubAction('platform-admin-id', 'club-id', 'club.archive'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it.each([
    {
      label: 'active Club Owner',
      platformRole: 'user',
      membershipStatus: 'active',
      responsibilities: ['owner'],
    },
    {
      label: 'Platform Administrator',
      platformRole: 'platform-admin',
      membershipStatus: null,
      responsibilities: [],
    },
  ] as const)('allows an $label to restore an archived Club', async (authorization) => {
    mockAuthorization({
      ...authorization,
      clubId: 'club-id',
      clubArchivedAt: new Date(),
    });

    await expect(requireClubAction('actor-id', 'club-id', 'club.restore')).resolves.toMatchObject({
      clubId: 'club-id',
    });
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

describe('Membership Request review authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['owner', 'admin'] as const)('allows an active Club %s', async (responsibility) => {
    mockAuthorization({
      platformRole: 'user',
      membershipStatus: 'active',
      responsibilities: [responsibility],
      clubId: 'club-id',
      clubArchivedAt: null,
    });

    await expect(
      requireMembershipRequestReviewer(`${responsibility}-id`, 'club-id'),
    ).resolves.toMatchObject({ responsibilities: [responsibility] });
  });

  it('allows a Platform Administrator who also has an authorized Club responsibility', async () => {
    mockAuthorization({
      platformRole: 'platform-admin',
      membershipStatus: 'active',
      responsibilities: ['admin', 'coach'],
      clubId: 'club-id',
      clubArchivedAt: null,
    });

    await expect(
      requireMembershipRequestReviewer('platform-admin-id', 'club-id'),
    ).resolves.toMatchObject({ responsibilities: ['admin', 'coach'] });
  });

  it.each([
    { platformRole: 'user', membershipStatus: 'active', responsibilities: ['coach'] },
    { platformRole: 'user', membershipStatus: 'active', responsibilities: [] },
    { platformRole: 'user', membershipStatus: 'suspended', responsibilities: ['admin'] },
    { platformRole: 'user', membershipStatus: 'ended', responsibilities: ['owner'] },
    { platformRole: 'platform-admin', membershipStatus: null, responsibilities: [] },
  ] as const)('rejects an unauthorized reviewer', async (authorization) => {
    mockAuthorization({
      ...authorization,
      clubId: 'club-id',
      clubArchivedAt: null,
    });

    await expect(requireMembershipRequestReviewer('actor-id', 'club-id')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});

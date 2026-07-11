import { db } from '../database';
import { requireClubAction, requireLockedClubAction } from '../authorization';
import {
  inviteClubMember,
  revokeClubInvitation,
  transferClubOwnership,
  updateClubMembership,
} from '../club-admin';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireClubAction: jest.fn(),
  requireLockedActiveClub: jest.fn().mockResolvedValue({ id: 'club-id', archivedAt: null }),
  requireLockedClubAction: jest.fn(),
}));

const mockDb = db as unknown as {
  select: jest.Mock;
  transaction: jest.Mock;
};
const mockRequireClubAction = requireClubAction as jest.Mock;
const mockRequireLockedClubAction = requireLockedClubAction as jest.Mock;

function mockSelect(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockMembership(
  status: 'active' | 'suspended' | 'ended',
  responsibilities: Array<'owner' | 'admin' | 'coach'>,
) {
  return {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [{ status, responsibilities }] }),
      }),
    })),
  };
}

function authorization(responsibilities: Array<'owner' | 'admin' | 'coach'>) {
  const result = {
    platformRole: 'user',
    membershipStatus: 'active',
    responsibilities,
    clubId: 'club-id',
    clubArchivedAt: null,
  };
  const authorize = (...args: unknown[]) => {
    const action = args.at(-1);
    if (action === 'members.manage-administrator' && !responsibilities.includes('owner')) {
      return Promise.reject({ code: 'FORBIDDEN', status: 403 });
    }
    return Promise.resolve(result);
  };
  mockRequireClubAction.mockImplementation(authorize);
  mockRequireLockedClubAction.mockImplementation(authorize);
}

describe('Club Membership management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();
  });

  it('requires ownership transfer before suspending the Owner', async () => {
    authorization(['owner']);
    const tx = mockMembership('active', ['owner', 'coach']);
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubMembership('owner-id', 'club-id', 'other-owner-id', {
        status: 'suspended',
      }),
    ).rejects.toMatchObject({
      code: 'OWNER_TRANSFER_REQUIRED',
      status: 409,
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('does not let an Administrator manage another Administrator', async () => {
    authorization(['admin']);
    const tx = mockMembership('active', ['admin', 'coach']);
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubMembership('admin-id', 'club-id', 'other-admin-id', {
        responsibilities: ['coach'],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('preserves responsibilities while suspending and reactivating a Membership', async () => {
    authorization(['owner']);
    const tx = {
      ...mockMembership('active', ['admin', 'coach']),
      update: jest.fn(() => ({
        set: (values: unknown) => ({
          where: () => ({
            returning: async () => [
              {
                clubId: 'club-id',
                userId: 'member-id',
                ...(values as object),
              },
            ],
          }),
        }),
      })),
      delete: jest.fn(),
      insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubMembership('owner-id', 'club-id', 'member-id', {
        status: 'suspended',
      }),
    ).resolves.toMatchObject({
      status: 'suspended',
      responsibilities: ['admin', 'coach'],
    });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('lets a Player voluntarily end their own Membership', async () => {
    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
      ...mockMembership('active', []),
      update: jest.fn(() => ({
        set: (values: unknown) => ({
          where: () => ({
            returning: async () => [
              {
                clubId: 'club-id',
                userId: 'member-id',
                ...(values as object),
              },
            ],
          }),
        }),
      })),
      delete: jest.fn(() => ({ where: deleteWhere })),
      insert: jest.fn(() => ({ values: insertValues })),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubMembership('member-id', 'club-id', 'member-id', {
        status: 'ended',
      }),
    ).resolves.toMatchObject({
      status: 'ended',
      responsibilities: [],
    });
    expect(mockRequireClubAction).not.toHaveBeenCalled();
    expect(tx.delete).toHaveBeenCalled();
  });

  it('still requires ownership transfer before the Owner voluntarily leaves', async () => {
    const tx = mockMembership('active', ['owner']);
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      updateClubMembership('owner-id', 'club-id', 'owner-id', {
        status: 'ended',
      }),
    ).rejects.toMatchObject({
      code: 'OWNER_TRANSFER_REQUIRED',
      status: 409,
    });
    expect(mockRequireClubAction).not.toHaveBeenCalled();
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Club Administrator hierarchy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();
  });

  it('does not let an Administrator replace an Owner-created Administrator invitation', async () => {
    authorization(['admin']);
    mockSelect([{ id: 'club-id', name: 'Club' }]);
    mockSelect([]);

    const forUpdate = jest
      .fn()
      .mockResolvedValue([{ id: 'invitation-id', responsibility: 'admin' }]);
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({ for: forUpdate }),
          }),
        }),
      })),
      update: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      inviteClubMember('admin-id', 'club-id', {
        email: 'player@example.com',
        responsibility: 'coach',
        locale: 'en-US',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('does not let an Administrator revoke an Administrator invitation', async () => {
    authorization(['admin']);

    const forUpdate = jest
      .fn()
      .mockResolvedValue([{ id: 'invitation-id', responsibility: 'admin' }]);
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({ for: forUpdate }),
          }),
        }),
      })),
      update: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      revokeClubInvitation('admin-id', 'club-id', 'invitation-id'),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe('Club ownership transfer audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.transaction.mockReset();
  });

  it('records both the previous and new Owner', async () => {
    const platformAuthorization = {
      platformRole: 'platform-admin',
      membershipStatus: null,
      responsibilities: [],
      clubId: 'club-id',
      clubArchivedAt: null,
    };
    mockRequireClubAction.mockResolvedValue(platformAuthorization);
    mockRequireLockedClubAction.mockResolvedValue(platformAuthorization);
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const forUpdate = jest.fn().mockResolvedValue([{ userId: 'previous-owner-id' }]);
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [{ status: 'active', responsibilities: ['coach'] }],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => ({ for: forUpdate }),
            }),
          }),
        }),
      delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
      insert: jest.fn(() => ({ values: insertValues })),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await transferClubOwnership('platform-admin-id', 'club-id', 'new-owner-id');

    expect(insertValues).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'club.owner.transfer',
        metadata: {
          previousOwnerId: 'previous-owner-id',
          newOwnerId: 'new-owner-id',
          newOwnerPreviousResponsibilities: ['coach'],
        },
      }),
    );
  });
});

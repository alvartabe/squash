import { db } from '../database';
import { requireClubAccess, requireClubAction } from '../authorization';
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
  requireClubAccess: jest.fn(),
  requireClubAction: jest.fn(),
}));

const mockDb = db as unknown as {
  select: jest.Mock;
  transaction: jest.Mock;
};
const mockRequireClubAccess = requireClubAccess as jest.Mock;
const mockRequireClubAction = requireClubAction as jest.Mock;

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
  mockSelect([{ status, responsibilities }]);
}

function authorization(responsibilities: Array<'owner' | 'admin' | 'coach'>) {
  mockRequireClubAction.mockResolvedValue({
    platformRole: 'user',
    membershipStatus: 'active',
    responsibilities,
    clubId: 'club-id',
    clubArchivedAt: null,
  });
}

describe('Club Membership management', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires ownership transfer before suspending the Owner', async () => {
    authorization(['owner']);
    mockMembership('active', ['owner', 'coach']);

    await expect(
      updateClubMembership('owner-id', 'club-id', 'other-owner-id', {
        status: 'suspended',
      }),
    ).rejects.toMatchObject({
      code: 'OWNER_TRANSFER_REQUIRED',
      status: 409,
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('does not let an Administrator manage another Administrator', async () => {
    authorization(['admin']);
    mockMembership('active', ['admin', 'coach']);

    await expect(
      updateClubMembership('admin-id', 'club-id', 'other-admin-id', {
        responsibilities: ['coach'],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('preserves responsibilities while suspending and reactivating a Membership', async () => {
    authorization(['owner']);
    mockMembership('active', ['admin', 'coach']);

    const tx = {
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
    mockMembership('active', []);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
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
    mockMembership('active', ['owner']);

    await expect(
      updateClubMembership('owner-id', 'club-id', 'owner-id', {
        status: 'ended',
      }),
    ).rejects.toMatchObject({
      code: 'OWNER_TRANSFER_REQUIRED',
      status: 409,
    });
    expect(mockRequireClubAction).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});

describe('Club Administrator hierarchy', () => {
  beforeEach(() => jest.clearAllMocks());

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
  beforeEach(() => jest.clearAllMocks());

  it('records both the previous and new Owner', async () => {
    mockRequireClubAccess.mockResolvedValue({
      platformRole: 'platform-admin',
      membershipStatus: null,
      responsibilities: [],
      clubId: 'club-id',
      clubArchivedAt: null,
    });
    mockSelect([{ status: 'active', responsibilities: ['coach'] }]);

    const insertValues = jest.fn().mockResolvedValue(undefined);
    const forUpdate = jest.fn().mockResolvedValue([{ userId: 'previous-owner-id' }]);
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({ for: forUpdate }),
          }),
        }),
      })),
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

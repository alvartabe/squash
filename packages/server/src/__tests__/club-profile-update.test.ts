import { auditLogs, clubs } from '@squash/db/schema';
import { requireClubAction } from '../authorization';
import { updateWorkspaceClub } from '../club-admin';
import { db } from '../database';
import { forbidden } from '../errors';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireClubAction: jest.fn(),
  requireClubAccess: jest.fn(),
  requireLockedClubAction: jest.fn().mockResolvedValue({
    membershipStatus: 'active',
    responsibilities: ['owner'],
  }),
  requirePlatformAdmin: jest.fn(),
}));

jest.mock('../media', () => ({
  createMediaDownloadUrl: jest.fn(),
  getMediaObjectKey: jest.fn(),
  requireOwnedClubLogoAsset: jest.fn(),
}));

const mockDb = db as unknown as {
  select: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  transaction: jest.Mock;
};
const mockRequireClubAction = requireClubAction as jest.Mock;

const input = {
  name: 'Updated Club',
  logoAssetId: null,
  description: 'Updated description',
  physicalAddress: 'Calle 1, San José',
  mapLink: null,
  contactEmail: null,
  contactPhone: '+506 2222-2222',
  timeZone: null,
};

describe('Club Profile updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireClubAction.mockResolvedValue({
      membershipStatus: 'active',
      responsibilities: ['owner'],
    });
  });

  it('writes the complete validated profile and preserves an explicitly null time zone', async () => {
    const currentLimit = jest.fn().mockResolvedValue([{ logoAssetId: null }]);
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({ limit: currentLimit }),
      }),
    });
    let updateValues: unknown;
    const updated = { id: 'club-id', ...input };
    mockDb.update.mockImplementationOnce((table: unknown) => {
      expect(table).toBe(clubs);
      return {
        set: (values: unknown) => {
          updateValues = values;
          return {
            where: () => ({
              returning: async () => [updated],
            }),
          };
        },
      };
    });
    let auditValue: unknown;
    mockDb.insert.mockImplementationOnce((table: unknown) => {
      expect(table).toBe(auditLogs);
      return {
        values: async (value: unknown) => {
          auditValue = value;
        },
      };
    });
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof mockDb) => unknown) => callback(mockDb),
    );

    await expect(updateWorkspaceClub('owner-id', 'club-id', input)).resolves.toEqual(updated);
    expect(mockRequireClubAction).toHaveBeenCalledWith('owner-id', 'club-id', 'club.update');
    expect(updateValues).toMatchObject(input);
    expect(updateValues).toHaveProperty('updatedAt', expect.any(Date));
    expect(auditValue).toMatchObject({
      actorId: 'owner-id',
      clubId: 'club-id',
      action: 'club.update',
      metadata: input,
    });
  });

  it('rejects an unauthorized Coach or ordinary Player before writing', async () => {
    mockRequireClubAction.mockRejectedValueOnce(forbidden());

    await expect(updateWorkspaceClub('coach-id', 'club-id', input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

import { createClubSchema, updateClubSchema } from '@squash/contracts';
import { auditLogs, clubMemberships, clubResponsibilities, clubs, users } from '@squash/db/schema';
import { requirePlatformAdmin } from '../authorization';
import { db } from '../database';
import { forbidden } from '../errors';
import { createClub } from '../services';

jest.mock('../database', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireActiveClubMembership: jest.fn(),
  requireClubAction: jest.fn(),
  requirePlatformAdmin: jest.fn(),
}));

const mockDb = db as unknown as { transaction: jest.Mock };
const mockRequirePlatformAdmin = requirePlatformAdmin as jest.Mock;

const input = {
  name: 'Central Squash Club',
  slug: 'central-squash-club',
  physicalAddress: 'Avenida Central, San José',
  contactEmail: 'hello@central.example',
  timeZone: null,
  initialOwnerId: 'initial-owner-id',
};

describe('Club creation contract', () => {
  it('requires an explicit initial Club Owner', () => {
    expect(() =>
      createClubSchema.parse({
        name: input.name,
        slug: input.slug,
        physicalAddress: input.physicalAddress,
        contactEmail: input.contactEmail,
        timeZone: input.timeZone,
      }),
    ).toThrow();
    expect(createClubSchema.parse(input)).toEqual(input);
  });

  it('requires a physical address and at least one contact method', () => {
    expect(() =>
      createClubSchema.parse({
        ...input,
        physicalAddress: '',
      }),
    ).toThrow();
    expect(() =>
      createClubSchema.parse({
        ...input,
        contactEmail: null,
        contactPhone: null,
      }),
    ).toThrow();
  });

  it('accepts either or both contact methods and a nullable time zone on explicit saves', () => {
    const profile = {
      name: input.name,
      physicalAddress: input.physicalAddress,
      contactEmail: input.contactEmail,
      contactPhone: '+506 2222-2222',
      timeZone: null,
    };
    expect(updateClubSchema.parse(profile)).toEqual(profile);
    expect(
      updateClubSchema.parse({
        ...profile,
        contactEmail: null,
      }),
    ).toEqual({
      ...profile,
      contactEmail: null,
    });
  });

  it('accepts only HTTP or HTTPS Club map links', () => {
    expect(
      updateClubSchema.parse({
        name: input.name,
        physicalAddress: input.physicalAddress,
        contactEmail: input.contactEmail,
        mapLink: 'https://maps.example/central',
      }).mapLink,
    ).toBe('https://maps.example/central');
    expect(() =>
      updateClubSchema.parse({
        name: input.name,
        physicalAddress: input.physicalAddress,
        contactEmail: input.contactEmail,
        mapLink: 'javascript:alert(1)',
      }),
    ).toThrow();
    expect(() =>
      updateClubSchema.parse({
        name: input.name,
        physicalAddress: input.physicalAddress,
        contactEmail: input.contactEmail,
        mapLink: 'squash://club/central',
      }),
    ).toThrow();
  });
});

describe('Club creation service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-Platform-Administrator before starting a transaction', async () => {
    mockRequirePlatformAdmin.mockRejectedValueOnce(forbidden());

    await expect(createClub('ordinary-player-id', input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('creates the Club with the explicitly assigned initial Owner and audits both identities', async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({ role: 'platform-admin' });
    const createdClub = {
      id: 'club-id',
      name: input.name,
      slug: input.slug,
      logoAssetId: null,
      description: null,
      physicalAddress: input.physicalAddress,
      mapLink: null,
      contactEmail: input.contactEmail,
      contactPhone: null,
      timeZone: input.timeZone,
    };
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const tx = {
      select: jest.fn((table: unknown) => {
        expect(table).toEqual({ id: users.id });
        return {
          from: (fromTable: unknown) => {
            expect(fromTable).toBe(users);
            return {
              where: () => ({
                limit: async () => [{ id: input.initialOwnerId }],
              }),
            };
          },
        };
      }),
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return table === clubs ? { returning: async () => [createdClub] } : Promise.resolve();
        },
      })),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(createClub('platform-admin-id', input)).resolves.toEqual(createdClub);

    expect(mockRequirePlatformAdmin).toHaveBeenCalledWith('platform-admin-id');
    expect(inserts.find((entry) => entry.table === clubs)?.values).toEqual({
      name: input.name,
      slug: input.slug,
      logoAssetId: null,
      description: null,
      physicalAddress: input.physicalAddress,
      mapLink: null,
      contactEmail: input.contactEmail,
      contactPhone: null,
      timeZone: input.timeZone,
    });
    expect(inserts.find((entry) => entry.table === clubMemberships)?.values).toEqual({
      clubId: createdClub.id,
      userId: input.initialOwnerId,
    });
    expect(inserts.find((entry) => entry.table === clubResponsibilities)?.values).toEqual({
      clubId: createdClub.id,
      userId: input.initialOwnerId,
      responsibility: 'owner',
    });
    expect(inserts.find((entry) => entry.table === auditLogs)?.values).toEqual({
      actorId: 'platform-admin-id',
      clubId: createdClub.id,
      action: 'club.create',
      entityType: 'club',
      entityId: createdClub.id,
      metadata: {
        name: input.name,
        slug: input.slug,
        logoAssetId: null,
        description: null,
        physicalAddress: input.physicalAddress,
        mapLink: null,
        contactEmail: input.contactEmail,
        contactPhone: null,
        timeZone: input.timeZone,
        initialOwnerId: input.initialOwnerId,
      },
    });
  });

  it('does not create a Club when the selected initial Owner is not a registered Player', async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({ role: 'platform-admin' });
    const tx = {
      select: jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      })),
      insert: jest.fn(),
    };
    mockDb.transaction.mockImplementationOnce(
      async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await expect(createClub('platform-admin-id', input)).rejects.toMatchObject({
      code: 'INITIAL_CLUB_OWNER_NOT_FOUND',
      status: 404,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

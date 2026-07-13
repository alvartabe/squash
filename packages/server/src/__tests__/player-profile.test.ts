import { db } from '../database';
import { getPlayerProfile, updateProfile } from '../services';

jest.mock('../database', () => ({ db: { select: jest.fn(), transaction: jest.fn() } }));

const mockDb = db as unknown as { select: jest.Mock; transaction: jest.Mock };

function profileSelect(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const leftJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ leftJoin }));
  mockDb.select.mockReturnValue({ from });
}

describe('Player Profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns no visibility choice before the Player has saved a Profile', async () => {
    profileSelect([
      {
        username: null,
        name: 'María Solís',
        bio: null,
        dominantHand: null,
        visibility: null,
        locale: 'es-419',
        timeZone: 'America/Costa_Rica',
      },
    ]);

    await expect(getPlayerProfile('player-id')).resolves.toEqual({
      username: null,
      name: 'María Solís',
      bio: null,
      dominantHand: null,
      visibility: null,
      locale: 'es-419',
      timeZone: 'America/Costa_Rica',
    });
  });

  it('reports case-insensitive database-enforced Username conflicts', async () => {
    mockDb.transaction.mockRejectedValueOnce({
      constraint: 'player_profiles_username_canonical_unique',
    });

    await expect(
      updateProfile('player-id', {
        username: 'Maria.Solis',
        name: 'María Solís',
        visibility: 'private',
        locale: 'es-419',
        timeZone: 'America/Costa_Rica',
      }),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN', status: 409 });
  });

  it('stores the NFC display Username and its case-insensitive uniqueness key', async () => {
    const values = jest.fn(() => ({ onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) }));
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
      })),
      insert: jest.fn(() => ({ values })),
    };
    mockDb.transaction.mockImplementationOnce(async (callback) => callback(tx));
    profileSelect([
      {
        username: 'María.Solis',
        name: 'María Solís',
        bio: null,
        dominantHand: null,
        visibility: 'private',
        locale: 'es-419',
        timeZone: 'America/Costa_Rica',
      },
    ]);

    await updateProfile('player-id', {
      username: 'Mari\u0301a.Solis',
      name: 'María Solís',
      visibility: 'private',
      locale: 'es-419',
      timeZone: 'America/Costa_Rica',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'María.Solis',
        usernameCanonical: 'maría.solis',
      }),
    );
  });
});

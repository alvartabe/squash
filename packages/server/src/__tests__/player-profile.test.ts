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

  it('reports database-enforced Username conflicts without choosing a comparison policy', async () => {
    mockDb.transaction.mockRejectedValueOnce({
      constraint: 'player_profiles_username_unique',
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
});

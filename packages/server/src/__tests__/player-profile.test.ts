import { db } from '../database';
import { getPlayerProfile } from '../player-profile';

jest.mock('../database', () => ({ db: { select: jest.fn() } }));

const mockDb = db as unknown as { select: jest.Mock };

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
});

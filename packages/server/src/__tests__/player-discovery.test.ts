import { db } from '../database';
import { findPlayerByExactUsername } from '../player-discovery';

jest.mock('../database', () => ({ db: { select: jest.fn() } }));

const mockDb = db as unknown as { select: jest.Mock };

function discoverySelect(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const innerJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ innerJoin }));
  mockDb.select.mockReturnValue({ from });
}

describe('exact Username discovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns only Username, display name, and avatar for an adult Player', async () => {
    discoverySelect([
      {
        username: 'Maria.Solis',
        displayName: 'María Solís',
        avatar: 'https://cdn.example/avatar.webp',
        isJunior: false,
        email: 'must-not-leak@example.com',
      },
    ]);

    await expect(findPlayerByExactUsername('Maria.Solis')).resolves.toEqual({
      username: 'Maria.Solis',
      displayName: 'María Solís',
      avatar: 'https://cdn.example/avatar.webp',
    });
  });

  it('returns no match when the exact Username does not exist', async () => {
    discoverySelect([]);
    await expect(findPlayerByExactUsername('missing')).resolves.toBeNull();
  });

  it('never returns a Junior Player from global Username discovery', async () => {
    discoverySelect([
      { username: 'junior', displayName: 'Junior Player', avatar: null, isJunior: true },
    ]);
    await expect(findPlayerByExactUsername('junior')).resolves.toBeNull();
  });
});

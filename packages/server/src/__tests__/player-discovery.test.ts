import { db } from '../database';
import { findPlayerByExactUsername } from '../player-discovery';
import type { SQLWrapper } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

jest.mock('../database', () => ({ db: { select: jest.fn() } }));

const mockDb = db as unknown as { select: jest.Mock };
const dialect = new PgDialect();
let discoveryCondition: SQLWrapper | undefined;

function discoverySelect(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn((condition: SQLWrapper) => {
    discoveryCondition = condition;
    return { limit };
  });
  const innerJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ innerJoin }));
  mockDb.select.mockReturnValue({ from });
}

describe('exact Username discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    discoveryCondition = undefined;
  });

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
    if (!discoveryCondition) throw new Error('Expected a discovery filter.');
    const query = dialect.sqlToQuery(discoveryCondition.getSQL());
    expect(query.sql).toContain('"player_profiles"."username_canonical" = $1');
    expect(query.sql).toContain('"users"."platform_suspended_at" is null');
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

  it('returns no match for a suspended adult and lets the same adult qualify after reactivation', async () => {
    discoverySelect([]);
    await expect(findPlayerByExactUsername('suspended.adult')).resolves.toBeNull();

    discoverySelect([
      {
        username: 'suspended.adult',
        displayName: 'Reactivated Player',
        avatar: null,
        isJunior: false,
      },
    ]);
    await expect(findPlayerByExactUsername('suspended.adult')).resolves.toEqual({
      username: 'suspended.adult',
      displayName: 'Reactivated Player',
      avatar: null,
    });
  });
});

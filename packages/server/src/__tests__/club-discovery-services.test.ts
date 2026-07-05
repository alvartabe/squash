import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { requireRegisteredPlayer } from '../authorization';
import { listDiscoverableClubs, resolveClubDiscoveryRelationship } from '../club-discovery';
import { db } from '../database';
import { forbidden } from '../errors';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireRegisteredPlayer: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock };
const mockRequireRegisteredPlayer = requireRegisteredPlayer as jest.Mock;
const dialect = new PgDialect();

type DiscoveryRow = {
  id: string;
  name: string;
  timeZone: string;
  membershipStatus: 'active' | 'suspended' | null;
  requestPending: boolean;
  invited: boolean;
};

function mockDiscoveryQueries(rows: DiscoveryRow[], total: number) {
  const offset = jest.fn().mockResolvedValue(rows);
  const limit = jest.fn(() => ({ offset }));
  const orderBy = jest.fn(() => ({ limit }));
  const itemWhere = jest.fn((_condition: unknown) => ({ orderBy }));
  const itemFrom = jest.fn(() => ({ where: itemWhere }));
  const totalWhere = jest.fn((_condition: unknown) => Promise.resolve([{ value: total }]));
  const totalFrom = jest.fn(() => ({ where: totalWhere }));

  mockDb.select.mockReturnValueOnce({ from: itemFrom }).mockReturnValueOnce({ from: totalFrom });

  return { itemWhere, limit, offset, totalWhere };
}

describe('Club discovery relationship precedence', () => {
  it.each([
    [{ membershipStatus: 'active', requestPending: true, invited: true }, 'active'],
    [{ membershipStatus: 'suspended', requestPending: true, invited: true }, 'suspended'],
    [{ membershipStatus: null, requestPending: true, invited: true }, 'request-pending'],
    [{ membershipStatus: null, requestPending: false, invited: true }, 'invited'],
    [{ membershipStatus: null, requestPending: false, invited: false }, 'none'],
  ] as const)('resolves %o as %s', (evidence, expected) => {
    expect(resolveClubDiscoveryRelationship(evidence)).toBe(expected);
  });
});

describe('Club discovery service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRegisteredPlayer.mockResolvedValue({
      id: 'player-id',
      email: 'player@example.com',
    });
  });

  it('requires a registered Player before querying Clubs', async () => {
    mockRequireRegisteredPlayer.mockRejectedValueOnce(forbidden());

    await expect(
      listDiscoverableClubs('missing-player-id', { page: 0, pageSize: 15, search: '' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns a deterministic page of Player-facing results', async () => {
    const rows: DiscoveryRow[] = [
      {
        id: 'club-one',
        name: 'Central Squash Club',
        timeZone: 'America/Costa_Rica',
        membershipStatus: 'active',
        requestPending: true,
        invited: true,
      },
      {
        id: 'club-two',
        name: 'Escazú Squash Club',
        timeZone: 'America/Costa_Rica',
        membershipStatus: null,
        requestPending: false,
        invited: true,
      },
    ];
    const query = { page: 2, pageSize: 2, search: 'squash' };
    const builders = mockDiscoveryQueries(rows, 7);

    await expect(listDiscoverableClubs('player-id', query)).resolves.toEqual({
      items: [
        {
          id: 'club-one',
          name: 'Central Squash Club',
          timeZone: 'America/Costa_Rica',
          relationship: 'active',
        },
        {
          id: 'club-two',
          name: 'Escazú Squash Club',
          timeZone: 'America/Costa_Rica',
          relationship: 'invited',
        },
      ],
      page: 2,
      pageSize: 2,
      total: 7,
      totalPages: 4,
    });
    expect(mockRequireRegisteredPlayer).toHaveBeenCalledWith('player-id');
    expect(builders.itemWhere).toHaveBeenCalledTimes(1);
    expect(builders.totalWhere).toHaveBeenCalledTimes(1);
    expect(builders.limit).toHaveBeenCalledWith(2);
    expect(builders.offset).toHaveBeenCalledWith(4);

    const condition = builders.itemWhere.mock.calls[0]?.[0] as SQL;
    expect(dialect.sqlToQuery(condition)).toMatchObject({
      sql: '("clubs"."archived_at" is null and "clubs"."name" ilike $1)',
      params: ['%squash%'],
    });

    const selected = mockDb.select.mock.calls[0]?.[0] as Record<string, { sql?: SQL }>;
    expect(dialect.sqlToQuery(selected.membershipStatus?.sql as SQL)).toMatchObject({
      sql: expect.stringContaining("cm.status in ('active', 'suspended')"),
      params: ['player-id'],
    });
    expect(dialect.sqlToQuery(selected.requestPending?.sql as SQL)).toMatchObject({
      sql: expect.stringContaining("mr.status = 'pending'"),
      params: ['player-id'],
    });
    expect(dialect.sqlToQuery(selected.invited?.sql as SQL)).toMatchObject({
      sql: expect.stringContaining('ci.expires_at > now()'),
      params: ['player@example.com'],
    });
  });

  it('returns an empty page without exposing internal relationship evidence', async () => {
    mockDiscoveryQueries([], 0);

    await expect(
      listDiscoverableClubs('player-id', { page: 0, pageSize: 15, search: '' }),
    ).resolves.toEqual({
      items: [],
      page: 0,
      pageSize: 15,
      total: 0,
      totalPages: 0,
    });
  });
});

import { db } from '../database';
import { requireClubAction } from '../authorization';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
  },
}));

const mockDb = db as unknown as { select: jest.Mock };

function mockAuthorization(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result ? [result] : []);
  const where = jest.fn(() => ({ limit }));
  const secondJoin = { where };
  const firstJoin = { leftJoin: jest.fn(() => secondJoin) };
  const from = jest.fn(() => ({ leftJoin: jest.fn(() => firstJoin) }));
  mockDb.select.mockReturnValueOnce({ from });
}

describe('club action authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects mutations against an archived club', async () => {
    mockAuthorization({
      platformRole: 'user',
      clubRole: 'owner',
      clubId: 'club-id',
      clubArchivedAt: new Date(),
    });

    await expect(requireClubAction('owner-id', 'club-id', 'club.manage')).rejects.toMatchObject({
      code: 'CLUB_ARCHIVED',
      status: 409,
    });
  });

  it('continues to authorize actions against an active club', async () => {
    const authorization = {
      platformRole: 'user' as const,
      clubRole: 'owner' as const,
      clubId: 'club-id',
      clubArchivedAt: null,
    };
    mockAuthorization(authorization);

    await expect(requireClubAction('owner-id', 'club-id', 'club.manage')).resolves.toEqual(
      authorization,
    );
  });
});

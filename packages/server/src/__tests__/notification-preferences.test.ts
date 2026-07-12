import { notificationPreferences } from '@squash/db/schema';
import { db } from '../database';
import { getNotificationPreferences, updateNotificationPreferences } from '../services';

jest.mock('../database', () => ({
  db: { insert: jest.fn(), select: jest.fn() },
}));

const mockDb = db as unknown as { insert: jest.Mock; select: jest.Mock };

function selectRows(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

describe('notification preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads enabled optional push categories when a Player has not set preferences', async () => {
    selectRows([]);

    await expect(getNotificationPreferences('player-id')).resolves.toEqual({
      social: true,
      playSessions: true,
      tournaments: true,
      clubs: true,
    });
  });

  it('updates only the requested optional push category and returns the persisted preferences', async () => {
    const writes: { values?: unknown; set?: unknown } = {};
    mockDb.insert.mockImplementationOnce((table: unknown) => {
      expect(table).toBe(notificationPreferences);
      return {
        values: (values: unknown) => {
          writes.values = values;
          return {
            onConflictDoUpdate: ({ set }: { set: unknown }) => {
              writes.set = set;
              return {
                returning: async () => [
                  {
                    socialPushEnabled: false,
                    playSessionsPushEnabled: true,
                    tournamentsPushEnabled: true,
                    clubsPushEnabled: true,
                  },
                ],
              };
            },
          };
        },
      };
    });

    await expect(updateNotificationPreferences('player-id', { social: false })).resolves.toEqual({
      social: false,
      playSessions: true,
      tournaments: true,
      clubs: true,
    });
    expect(writes.values).toEqual({ userId: 'player-id', socialPushEnabled: false });
    expect(writes.set).toMatchObject({ socialPushEnabled: false });
  });
});

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
    let persisted = {
      socialPushEnabled: true,
      playSessionsPushEnabled: true,
      tournamentsPushEnabled: true,
      clubsPushEnabled: true,
    };
    mockDb.insert.mockImplementationOnce(() => {
      return {
        values: () => {
          return {
            onConflictDoUpdate: ({ set }: { set: Partial<typeof persisted> }) => {
              persisted = { ...persisted, ...set };
              return {
                returning: async () => [persisted],
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

    selectRows([persisted]);
    await expect(getNotificationPreferences('player-id')).resolves.toEqual({
      social: false,
      playSessions: true,
      tournaments: true,
      clubs: true,
    });
  });
});

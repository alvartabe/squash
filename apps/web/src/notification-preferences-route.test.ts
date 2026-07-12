import { getNotificationPreferences, updateNotificationPreferences } from '@squash/server';
import { GET, PATCH } from '../app/api/v1/notification-preferences/route';

jest.mock('@squash/server', () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown, status = 200) => ({ status, json: async () => ({ data }) }),
  playerRoute:
    (handler: (actorId: string, request: Request) => Promise<Response>) =>
    async (request: Request) => {
      try {
        return await handler('authenticated-player-id', request);
      } catch {
        return {
          status: 400,
          json: async () => ({ error: { code: 'INVALID_REQUEST' } }),
        };
      }
    },
}));

const mockGetNotificationPreferences = getNotificationPreferences as jest.Mock;
const mockUpdateNotificationPreferences = updateNotificationPreferences as jest.Mock;

describe('notification preference Player routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the authenticated Player preferences', async () => {
    const preferences = { social: true, playSessions: true, tournaments: true, clubs: true };
    mockGetNotificationPreferences.mockResolvedValueOnce(preferences);

    const response = await GET({} as Request, {});

    expect(mockGetNotificationPreferences).toHaveBeenCalledWith('authenticated-player-id');
    await expect(response.json()).resolves.toEqual({ data: preferences });
  });

  it('updates an optional push category for the authenticated Player', async () => {
    const preferences = { social: false, playSessions: true, tournaments: true, clubs: true };
    mockUpdateNotificationPreferences.mockResolvedValueOnce(preferences);

    const response = await PATCH(
      { json: async () => ({ social: false }) } as unknown as Request,
      {},
    );

    expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith('authenticated-player-id', {
      social: false,
    });
    await expect(response.json()).resolves.toEqual({ data: preferences });
  });

  it.each([{ security: false }, { consent: false }, { accountRecovery: false }])(
    'does not accept a setting for mandatory communications: %o',
    async (body) => {
      const response = await PATCH({ json: async () => body } as unknown as Request, {});

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: { code: 'INVALID_REQUEST' } });
      expect(mockUpdateNotificationPreferences).not.toHaveBeenCalled();
    },
  );
});

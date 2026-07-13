import { listInAppNotifications, markInAppNotificationRead } from '@squash/server';
import { GET } from '../app/api/v1/notifications/route';
import { POST } from '../app/api/v1/notifications/[notificationId]/read/route';

jest.mock('@squash/server', () => ({
  listInAppNotifications: jest.fn(),
  markInAppNotificationRead: jest.fn(),
}));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown, status = 200) => ({ status, json: async () => ({ data }) }),
  playerRoute:
    (handler: (actorId: string, request: Request, context: unknown) => Promise<Response>) =>
    async (request: Request, context: unknown) =>
      handler('authenticated-player-id', request, context),
}));

const mockListInAppNotifications = listInAppNotifications as jest.Mock;
const mockMarkInAppNotificationRead = markInAppNotificationRead as jest.Mock;
const notification = {
  id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
  type: 'club-play-session.invited' as const,
  clubPlaySessionId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
  readAt: null,
  createdAt: '2026-07-12T15:00:00.000Z',
};

describe('in-app notification Player routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the authenticated Player public notification projection', async () => {
    mockListInAppNotifications.mockResolvedValueOnce([notification]);

    const response = await GET({} as Request, {});

    expect(mockListInAppNotifications).toHaveBeenCalledWith('authenticated-player-id');
    await expect(response.json()).resolves.toEqual({ data: [notification] });
  });

  it('marks the authenticated Player notification read', async () => {
    mockMarkInAppNotificationRead.mockResolvedValueOnce({
      ...notification,
      readAt: '2026-07-12T16:00:00.000Z',
    });

    const response = await POST({} as Request, {
      params: Promise.resolve({ notificationId: notification.id }),
    });

    expect(mockMarkInAppNotificationRead).toHaveBeenCalledWith(
      'authenticated-player-id',
      notification.id,
    );
    await expect(response.json()).resolves.toEqual({
      data: { ...notification, readAt: '2026-07-12T16:00:00.000Z' },
    });
  });
});

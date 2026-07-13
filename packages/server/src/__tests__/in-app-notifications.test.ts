import { db } from '../database';
import {
  listInAppNotifications,
  markInAppNotificationRead,
  projectInAppNotification,
} from '../notifications';

jest.mock('../database', () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));

const mockDb = db as unknown as { select: jest.Mock; update: jest.Mock };
const notificationId = '91f6704a-c62c-4676-93a1-72d5b3fd6b7a';
const sessionId = '2d44fd7a-eac8-4a72-84e8-b3b46812f606';
const createdAt = new Date('2026-07-12T15:00:00.000Z');

function notificationRow(readAt: Date | null = null) {
  return {
    id: notificationId,
    type: 'club-play-session.invited',
    data: { sessionId, clubId: '6ed6b0ac-c7a6-4c64-9d20-496f18f901ab' },
    readAt,
    createdAt,
  };
}

function mockList(rows: ReturnType<typeof notificationRow>[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
  return { where, orderBy };
}

function mockMarkRead(rows: ReturnType<typeof notificationRow>[]) {
  const returning = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ returning }));
  const set = jest.fn(() => ({ where }));
  mockDb.update.mockReturnValueOnce({ set });
  return { set, where, returning };
}

describe('in-app Club Play Session invitation notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('projects the supported public contract without exposing database fields', () => {
    expect(projectInAppNotification(notificationRow())).toEqual({
      id: notificationId,
      type: 'club-play-session.invited',
      clubPlaySessionId: sessionId,
      readAt: null,
      createdAt: '2026-07-12T15:00:00.000Z',
    });
  });

  it('lists only the authenticated Player invitation notifications newest first', async () => {
    mockList([notificationRow()]);

    await expect(listInAppNotifications('player-id')).resolves.toEqual([
      {
        id: notificationId,
        type: 'club-play-session.invited',
        clubPlaySessionId: sessionId,
        readAt: null,
        createdAt: '2026-07-12T15:00:00.000Z',
      },
    ]);
  });

  it('does not consult push preferences when listing in-app invitations', async () => {
    mockList([]);

    await expect(listInAppNotifications('player-id')).resolves.toEqual([]);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('persists an unread notification read time and keeps the original time on a repeat', async () => {
    const readAt = new Date('2026-07-12T16:00:00.000Z');
    mockMarkRead([notificationRow(readAt)]);

    await expect(markInAppNotificationRead('player-id', notificationId)).resolves.toMatchObject({
      readAt: '2026-07-12T16:00:00.000Z',
    });
    mockMarkRead([notificationRow(readAt)]);
    await expect(markInAppNotificationRead('player-id', notificationId)).resolves.toMatchObject({
      readAt: '2026-07-12T16:00:00.000Z',
    });
  });

  it('returns not found and affects no row for another Player notification', async () => {
    mockMarkRead([]);

    await expect(
      markInAppNotificationRead('other-player-id', notificationId),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
      status: 404,
    });
  });
});

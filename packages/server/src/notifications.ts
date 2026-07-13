import { inAppNotificationSchema, type InAppNotification } from '@squash/contracts';
import { notifications } from '@squash/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './database';
import { notFound } from './errors';

type NotificationRow = {
  id: string;
  type: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
};

const clubPlaySessionInvitationDataSchema = inAppNotificationSchema
  .pick({ clubPlaySessionId: true })
  .transform(({ clubPlaySessionId }) => ({ sessionId: clubPlaySessionId }));

export function projectInAppNotification(row: NotificationRow): InAppNotification {
  if (row.type !== 'club-play-session.invited') {
    throw new Error(`Unsupported in-app notification type: ${row.type}`);
  }
  const { sessionId } = clubPlaySessionInvitationDataSchema.parse({
    clubPlaySessionId:
      typeof row.data === 'object' && row.data !== null && 'sessionId' in row.data
        ? row.data.sessionId
        : undefined,
  });
  return inAppNotificationSchema.parse({
    id: row.id,
    type: row.type,
    clubPlaySessionId: sessionId,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

const notificationColumns = {
  id: notifications.id,
  type: notifications.type,
  data: notifications.data,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

export async function listInAppNotifications(actorId: string): Promise<InAppNotification[]> {
  const rows = await db
    .select(notificationColumns)
    .from(notifications)
    .where(
      and(eq(notifications.userId, actorId), eq(notifications.type, 'club-play-session.invited')),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return rows.map(projectInAppNotification);
}

export async function markInAppNotificationRead(
  actorId: string,
  notificationId: string,
): Promise<InAppNotification> {
  const [notification] = await db
    .update(notifications)
    .set({
      readAt: sql`coalesce(${notifications.readAt}, now())`,
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, actorId),
        eq(notifications.type, 'club-play-session.invited'),
      ),
    )
    .returning(notificationColumns);
  if (!notification) throw notFound('NOTIFICATION_NOT_FOUND');
  return projectInAppNotification(notification);
}

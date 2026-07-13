import { updateNotificationPreferencesSchema } from '@squash/contracts';
import { getNotificationPreferences, updateNotificationPreferences } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string) =>
  dataResponse(await getNotificationPreferences(actorId)),
);

export const PATCH = playerRoute(async (actorId: string, request: Request) =>
  dataResponse(
    await updateNotificationPreferences(
      actorId,
      updateNotificationPreferencesSchema.parse(await request.json()),
    ),
  ),
);

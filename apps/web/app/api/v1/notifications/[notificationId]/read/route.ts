import { idSchema } from '@squash/contracts';
import { markInAppNotificationRead } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ notificationId: string }> };

export const POST = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { notificationId } = await params;
  return dataResponse(await markInAppNotificationRead(actorId, idSchema.parse(notificationId)));
});

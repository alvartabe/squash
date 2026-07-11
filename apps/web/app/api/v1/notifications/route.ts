import { listNotifications } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string) => {
  return dataResponse(await listNotifications(actorId));
});

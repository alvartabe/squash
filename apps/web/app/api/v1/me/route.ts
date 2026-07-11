import { getCurrentWorkspaceUser } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const GET = managementRoute(async (actorId: string) => {
  return dataResponse(await getCurrentWorkspaceUser(actorId));
});

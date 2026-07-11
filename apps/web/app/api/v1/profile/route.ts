import { profileSchema } from '@squash/contracts';
import { updateProfile } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const PUT = playerRoute(async (actorId: string, request: Request) => {
  return dataResponse(await updateProfile(actorId, profileSchema.parse(await request.json())));
});

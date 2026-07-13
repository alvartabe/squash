import { profileSchema } from '@squash/contracts';
import { getPlayerProfile, updateProfile } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string) => {
  return dataResponse(await getPlayerProfile(actorId));
});

export const PUT = playerRoute(async (actorId: string, request: Request) => {
  return dataResponse(await updateProfile(actorId, profileSchema.parse(await request.json())));
});

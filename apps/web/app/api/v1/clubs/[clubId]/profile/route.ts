import { idSchema } from '@squash/contracts';
import { getPlayerFacingClubProfile } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const GET = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { clubId } = await params;
  return dataResponse(await getPlayerFacingClubProfile(actorId, idSchema.parse(clubId)));
});

import { acceptClubInvitation } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ token: string }> };

export const POST = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { token } = await params;
  return dataResponse(await acceptClubInvitation(actorId, token));
});

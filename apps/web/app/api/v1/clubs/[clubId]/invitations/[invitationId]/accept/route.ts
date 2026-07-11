import { idSchema } from '@squash/contracts';
import { acceptPlayerClubInvitation } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string; invitationId: string }> };

export const POST = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { clubId, invitationId } = await params;
  return dataResponse(
    await acceptPlayerClubInvitation(actorId, idSchema.parse(clubId), idSchema.parse(invitationId)),
  );
});

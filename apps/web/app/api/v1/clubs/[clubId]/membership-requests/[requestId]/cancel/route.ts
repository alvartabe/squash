import { idSchema } from '@squash/contracts';
import { cancelMembershipRequest } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string; requestId: string }> };

export const POST = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { clubId, requestId } = await params;
  return dataResponse(
    await cancelMembershipRequest(actorId, idSchema.parse(clubId), idSchema.parse(requestId)),
  );
});

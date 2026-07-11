import { idSchema, membershipRequestListQuerySchema } from '@squash/contracts';
import { listMembershipRequests, submitMembershipRequest } from '@squash/server';
import { dataResponse, managementRoute, playerRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const GET = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    const query = membershipRequestListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listMembershipRequests(actorId, idSchema.parse(clubId), query));
  },
);

export const POST = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { clubId } = await params;
  return dataResponse(await submitMembershipRequest(actorId, idSchema.parse(clubId)), 201);
});

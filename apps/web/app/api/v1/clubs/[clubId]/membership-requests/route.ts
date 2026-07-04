import { idSchema, membershipRequestListQuerySchema } from '@squash/contracts';
import { listMembershipRequests, submitMembershipRequest } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId } = await params;
    const query = membershipRequestListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listMembershipRequests(actorId, idSchema.parse(clubId), query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(_request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId } = await params;
    return dataResponse(await submitMembershipRequest(actorId, idSchema.parse(clubId)), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

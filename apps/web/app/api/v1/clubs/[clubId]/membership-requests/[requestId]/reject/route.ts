import { idSchema } from '@squash/contracts';
import { rejectMembershipRequest } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string; requestId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId, requestId } = await params;
    return dataResponse(
      await rejectMembershipRequest(actorId, idSchema.parse(clubId), idSchema.parse(requestId)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

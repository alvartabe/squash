import { idSchema, updateClubMemberSchema, userIdSchema } from '@squash/contracts';
import { removeClubMember, updateClubMembership } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string; userId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId, userId } = await params;
    const input = updateClubMemberSchema.parse(await request.json());
    const parsedClubId = idSchema.parse(clubId);
    const parsedUserId = userIdSchema.parse(userId);
    return dataResponse(
      await updateClubMembership(actorId, parsedClubId, parsedUserId, {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.responsibilities === undefined
          ? {}
          : { responsibilities: input.responsibilities }),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId, userId } = await params;
    return dataResponse(
      await removeClubMember(actorId, idSchema.parse(clubId), userIdSchema.parse(userId)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

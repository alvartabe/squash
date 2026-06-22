import { idSchema, updateClubMemberSchema, userIdSchema } from '@squash/contracts';
import { removeClubMember, updateClubMemberRole } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string; userId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId, userId } = await params;
    const input = updateClubMemberSchema.parse(await request.json());
    return dataResponse(
      await updateClubMemberRole(
        actorId,
        idSchema.parse(clubId),
        userIdSchema.parse(userId),
        input.role,
      ),
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

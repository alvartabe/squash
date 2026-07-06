import { idSchema } from '@squash/contracts';
import { revokeClubInvitation } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string; invitationId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId, invitationId } = await params;
    return dataResponse(
      await revokeClubInvitation(actorId, idSchema.parse(clubId), idSchema.parse(invitationId)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

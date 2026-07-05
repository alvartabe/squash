import { idSchema } from '@squash/contracts';
import { acceptPlayerClubInvitation } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string; invitationId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId, invitationId } = await params;
    return dataResponse(
      await acceptPlayerClubInvitation(
        actorId,
        idSchema.parse(clubId),
        idSchema.parse(invitationId),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

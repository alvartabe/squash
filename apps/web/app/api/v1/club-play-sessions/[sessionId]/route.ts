import {
  cancelClubPlaySessionSchema,
  idSchema,
  updateClubPlaySessionSchema,
} from '@squash/contracts';
import { cancelClubPlaySession, getClubPlaySession, updateClubPlaySession } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId, requireUserId } from '@/src/http';

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { sessionId } = await params;
    return dataResponse(await getClubPlaySession(actorId, idSchema.parse(sessionId)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { sessionId } = await params;
    return dataResponse(
      await updateClubPlaySession(
        actorId,
        idSchema.parse(sessionId),
        updateClubPlaySessionSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { sessionId } = await params;
    const { expectedVersion } = cancelClubPlaySessionSchema.parse(await request.json());
    return dataResponse(
      await cancelClubPlaySession(actorId, idSchema.parse(sessionId), expectedVersion),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

import { idSchema, updateClubSchema } from '@squash/contracts';
import { archiveWorkspaceClub, getWorkspaceClub, updateWorkspaceClub } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId } = await params;
    return dataResponse(await getWorkspaceClub(actorId, idSchema.parse(clubId)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId } = await params;
    return dataResponse(
      await updateWorkspaceClub(
        actorId,
        idSchema.parse(clubId),
        updateClubSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId } = await params;
    return dataResponse(await archiveWorkspaceClub(actorId, idSchema.parse(clubId)));
  } catch (error) {
    return errorResponse(error);
  }
}

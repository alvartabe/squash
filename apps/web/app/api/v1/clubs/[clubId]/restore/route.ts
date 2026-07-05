import { idSchema } from '@squash/contracts';
import { restoreWorkspaceClub } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId } = await params;
    return dataResponse(await restoreWorkspaceClub(actorId, idSchema.parse(clubId)));
  } catch (error) {
    return errorResponse(error);
  }
}

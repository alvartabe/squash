import { idSchema } from '@squash/contracts';
import { restoreWorkspaceClub } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const POST = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { clubId } = await params;
    return dataResponse(await restoreWorkspaceClub(actorId, idSchema.parse(clubId)));
  },
);

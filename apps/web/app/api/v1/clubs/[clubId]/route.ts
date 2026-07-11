import { idSchema, updateClubSchema } from '@squash/contracts';
import { archiveWorkspaceClub, getWorkspaceClub, updateWorkspaceClub } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const GET = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { clubId } = await params;
    return dataResponse(await getWorkspaceClub(actorId, idSchema.parse(clubId)));
  },
);

export const PATCH = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    return dataResponse(
      await updateWorkspaceClub(
        actorId,
        idSchema.parse(clubId),
        updateClubSchema.parse(await request.json()),
      ),
    );
  },
);

export const DELETE = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { clubId } = await params;
    return dataResponse(await archiveWorkspaceClub(actorId, idSchema.parse(clubId)));
  },
);

import {
  cancelClubPlaySessionSchema,
  idSchema,
  updateClubPlaySessionSchema,
} from '@squash/contracts';
import { cancelClubPlaySession, getClubPlaySession, updateClubPlaySession } from '@squash/server';
import { dataResponse, managementRoute, playerRoute } from '@/src/http';

type Context = { params: Promise<{ sessionId: string }> };

export const GET = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { sessionId } = await params;
  return dataResponse(await getClubPlaySession(actorId, idSchema.parse(sessionId)));
});

export const PATCH = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { sessionId } = await params;
    return dataResponse(
      await updateClubPlaySession(
        actorId,
        idSchema.parse(sessionId),
        updateClubPlaySessionSchema.parse(await request.json()),
      ),
    );
  },
);

export const DELETE = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { sessionId } = await params;
    const { expectedVersion } = cancelClubPlaySessionSchema.parse(await request.json());
    return dataResponse(
      await cancelClubPlaySession(actorId, idSchema.parse(sessionId), expectedVersion),
    );
  },
);

import { userIdSchema } from '@squash/contracts';
import { reactivatePlayer, suspendPlayer } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ playerId: string }> };

export const POST = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { playerId } = await params;
    return dataResponse(await suspendPlayer(actorId, userIdSchema.parse(playerId)));
  },
);

export const DELETE = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { playerId } = await params;
    return dataResponse(await reactivatePlayer(actorId, userIdSchema.parse(playerId)));
  },
);

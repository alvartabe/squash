import { getPlayerStatistics } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(
  async (
    _actorId: string,
    _request: Request,
    context: { params: Promise<{ playerId: string }> },
  ) => {
    const { playerId } = await context.params;
    return dataResponse(await getPlayerStatistics(playerId));
  },
);

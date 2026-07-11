import { removeTournamentPlayer } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const DELETE = managementRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string; playerId: string }> },
  ) => {
    const { tournamentId, playerId } = await context.params;
    return dataResponse(await removeTournamentPlayer(actorId, tournamentId, playerId));
  },
);

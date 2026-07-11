import { requestTournamentEntry } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const POST = playerRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    return dataResponse(await requestTournamentEntry(actorId, tournamentId), 201);
  },
);

import { decideTournamentEntryRequest } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string; requestId: string }> },
  ) => {
    const { tournamentId, requestId } = await context.params;
    return dataResponse(
      await decideTournamentEntryRequest(actorId, tournamentId, requestId, false),
    );
  },
);

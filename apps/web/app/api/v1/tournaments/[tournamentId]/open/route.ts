import { openTournamentRegistration } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    return dataResponse(await openTournamentRegistration(actorId, tournamentId));
  },
);

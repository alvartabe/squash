import { getTournamentManagement } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const GET = managementRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    return dataResponse(await getTournamentManagement(actorId, tournamentId));
  },
);

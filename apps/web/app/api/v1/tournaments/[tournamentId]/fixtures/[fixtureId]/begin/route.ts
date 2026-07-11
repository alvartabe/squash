import { beginOfficialTournamentMatch } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string; fixtureId: string }> },
  ) => {
    const { tournamentId, fixtureId } = await context.params;
    return dataResponse(await beginOfficialTournamentMatch(actorId, tournamentId, fixtureId));
  },
);

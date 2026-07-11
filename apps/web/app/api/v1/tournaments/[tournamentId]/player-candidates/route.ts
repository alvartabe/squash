import { listTournamentPlayerCandidates } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const GET = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    const search = new URL(request.url).searchParams.get('search')?.trim().slice(0, 120) ?? '';
    return dataResponse(await listTournamentPlayerCandidates(actorId, tournamentId, search));
  },
);

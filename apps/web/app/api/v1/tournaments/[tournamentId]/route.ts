import { getOfficialTournamentPlayerDetail } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ tournamentId: string }> };

export const GET = playerRoute(async (actorId: string, _request: Request, { params }: Context) => {
  const { tournamentId } = await params;
  return dataResponse(await getOfficialTournamentPlayerDetail(actorId, tournamentId));
});

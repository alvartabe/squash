import { listClubTournaments } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const GET = managementRoute(
  async (actorId: string, _request: Request, context: { params: Promise<{ clubId: string }> }) => {
    const { clubId } = await context.params;
    return dataResponse(await listClubTournaments(actorId, clubId));
  },
);

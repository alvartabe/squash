import { tournamentPlayerActionSchema } from '@squash/contracts';
import { directlyAddTournamentPlayer } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    const { playerId } = tournamentPlayerActionSchema.parse(await request.json());
    return dataResponse(await directlyAddTournamentPlayer(actorId, tournamentId, playerId), 201);
  },
);

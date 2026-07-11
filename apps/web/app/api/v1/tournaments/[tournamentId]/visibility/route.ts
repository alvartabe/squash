import { updateTournamentVisibilitySchema } from '@squash/contracts';
import { updateTournamentVisibility } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const PATCH = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    const input = updateTournamentVisibilitySchema.parse(await request.json());
    return dataResponse(await updateTournamentVisibility(actorId, tournamentId, input.visibility));
  },
);

import { registerForTournament } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const actorId = await requireUserId();
    const { tournamentId } = await context.params;
    return dataResponse(await registerForTournament(actorId, tournamentId), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

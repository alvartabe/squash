import { generateTournamentGroups } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const actorId = await requireUserId();
    const { tournamentId } = await context.params;
    return dataResponse(await generateTournamentGroups(actorId, tournamentId));
  } catch (error) {
    return errorResponse(error);
  }
}

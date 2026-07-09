import { requestTournamentEntry } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    return dataResponse(await requestTournamentEntry(await requireUserId(), tournamentId), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

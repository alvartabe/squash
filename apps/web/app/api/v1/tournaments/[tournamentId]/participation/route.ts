import { withdrawTournamentParticipation } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    return dataResponse(await withdrawTournamentParticipation(await requireUserId(), tournamentId));
  } catch (error) {
    return errorResponse(error);
  }
}

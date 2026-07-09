import { removeTournamentPlayer } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tournamentId: string; playerId: string }> },
) {
  try {
    const { tournamentId, playerId } = await context.params;
    return dataResponse(
      await removeTournamentPlayer(await requireManagementUserId(), tournamentId, playerId),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

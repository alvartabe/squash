import { tournamentPlayerActionSchema } from '@squash/contracts';
import { directlyAddTournamentPlayer } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function POST(
  request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    const { playerId } = tournamentPlayerActionSchema.parse(await request.json());
    return dataResponse(
      await directlyAddTournamentPlayer(await requireManagementUserId(), tournamentId, playerId),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

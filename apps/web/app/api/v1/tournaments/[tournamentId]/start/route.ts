import { startTournament } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function POST(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    return dataResponse(await startTournament(await requireManagementUserId(), tournamentId));
  } catch (error) {
    return errorResponse(error);
  }
}

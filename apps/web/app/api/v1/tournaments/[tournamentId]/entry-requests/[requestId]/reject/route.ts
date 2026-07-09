import { decideTournamentEntryRequest } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function POST(
  _request: Request,
  context: { params: Promise<{ tournamentId: string; requestId: string }> },
) {
  try {
    const { tournamentId, requestId } = await context.params;
    return dataResponse(
      await decideTournamentEntryRequest(
        await requireManagementUserId(),
        tournamentId,
        requestId,
        false,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

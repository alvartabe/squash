import { listTournamentPlayerCandidates } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function GET(
  request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    const search = new URL(request.url).searchParams.get('search')?.trim().slice(0, 120) ?? '';
    return dataResponse(
      await listTournamentPlayerCandidates(await requireManagementUserId(), tournamentId, search),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

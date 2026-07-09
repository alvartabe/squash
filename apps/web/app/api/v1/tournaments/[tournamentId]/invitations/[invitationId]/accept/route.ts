import { respondToTournamentInvitation } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(
  _request: Request,
  context: { params: Promise<{ tournamentId: string; invitationId: string }> },
) {
  try {
    const { tournamentId, invitationId } = await context.params;
    return dataResponse(
      await respondToTournamentInvitation(await requireUserId(), tournamentId, invitationId, true),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

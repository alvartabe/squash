import { respondToTournamentInvitation } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const POST = playerRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ tournamentId: string; invitationId: string }> },
  ) => {
    const { tournamentId, invitationId } = await context.params;
    return dataResponse(
      await respondToTournamentInvitation(actorId, tournamentId, invitationId, true),
    );
  },
);

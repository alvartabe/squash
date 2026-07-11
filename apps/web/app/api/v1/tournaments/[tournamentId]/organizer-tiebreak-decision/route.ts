import { organizerTiebreakDecisionInputSchema } from '@squash/contracts';
import { submitOrganizerTiebreakDecision } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string }> },
  ) => {
    const { tournamentId } = await context.params;
    const input = organizerTiebreakDecisionInputSchema.parse(await request.json());
    return dataResponse(await submitOrganizerTiebreakDecision(actorId, tournamentId, input), 201);
  },
);

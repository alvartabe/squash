import { organizerTiebreakDecisionInputSchema } from '@squash/contracts';
import { submitOrganizerTiebreakDecision } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function POST(
  request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    const input = organizerTiebreakDecisionInputSchema.parse(await request.json());
    return dataResponse(
      await submitOrganizerTiebreakDecision(await requireManagementUserId(), tournamentId, input),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

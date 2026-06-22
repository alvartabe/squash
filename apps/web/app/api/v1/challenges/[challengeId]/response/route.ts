import { respondToChallengeSchema } from '@squash/contracts';
import { respondToChallenge } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function PUT(request: Request, context: { params: Promise<{ challengeId: string }> }) {
  try {
    const actorId = await requireUserId();
    const { challengeId } = await context.params;
    const { accept } = respondToChallengeSchema.parse(await request.json());
    return dataResponse(await respondToChallenge(actorId, challengeId, accept));
  } catch (error) {
    return errorResponse(error);
  }
}

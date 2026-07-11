import { respondToChallengeSchema } from '@squash/contracts';
import { respondToChallenge } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const PUT = playerRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ challengeId: string }> },
  ) => {
    const { challengeId } = await context.params;
    const { accept } = respondToChallengeSchema.parse(await request.json());
    return dataResponse(await respondToChallenge(actorId, challengeId, accept));
  },
);

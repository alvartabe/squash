import { disputeChallengeSchema, idSchema } from '@squash/contracts';
import { disputeChallenge } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ challengeId: string }> };

export const POST = playerRoute(async (actorId: string, request: Request, { params }: Context) => {
  const { challengeId } = await params;
  const input = disputeChallengeSchema.parse(await request.json());
  return dataResponse(await disputeChallenge(actorId, idSchema.parse(challengeId), input.reason));
});

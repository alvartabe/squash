import { cancelChallengeSchema, idSchema } from '@squash/contracts';
import { cancelChallenge } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

type Context = { params: Promise<{ challengeId: string }> };

export const POST = playerRoute(async (actorId: string, request: Request, { params }: Context) => {
  const { challengeId } = await params;
  const input = cancelChallengeSchema.parse(await request.json().catch(() => ({})));
  return dataResponse(await cancelChallenge(actorId, idSchema.parse(challengeId), input.reason));
});

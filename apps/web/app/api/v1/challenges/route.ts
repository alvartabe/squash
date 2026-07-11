import { createChallengeSchema } from '@squash/contracts';
import { createChallenge } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const POST = playerRoute(async (actorId: string, request: Request) => {
  const input = createChallengeSchema.parse(await request.json());
  return dataResponse(await createChallenge(actorId, input), 201);
});

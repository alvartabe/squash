import { createChallengeSchema } from '@squash/contracts';
import { createChallenge } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    const input = createChallengeSchema.parse(await request.json());
    return dataResponse(await createChallenge(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

import { cancelChallengeSchema, idSchema } from '@squash/contracts';
import { cancelChallenge } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ challengeId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { challengeId } = await params;
    const input = cancelChallengeSchema.parse(await request.json().catch(() => ({})));
    return dataResponse(await cancelChallenge(actorId, idSchema.parse(challengeId), input.reason));
  } catch (error) {
    return errorResponse(error);
  }
}

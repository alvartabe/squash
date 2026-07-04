import { disputeChallengeSchema, idSchema } from '@squash/contracts';
import { disputeChallenge } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ challengeId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { challengeId } = await params;
    const input = disputeChallengeSchema.parse(await request.json());
    return dataResponse(await disputeChallenge(actorId, idSchema.parse(challengeId), input.reason));
  } catch (error) {
    return errorResponse(error);
  }
}

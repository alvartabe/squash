import { submitMatchResultSchema } from '@squash/contracts';
import { submitMatchResult } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function PUT(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const actorId = await requireUserId();
    const { matchId } = await context.params;
    const input = submitMatchResultSchema.parse(await request.json());
    return dataResponse(
      await submitMatchResult(actorId, matchId, input.sets, input.revisionReason),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

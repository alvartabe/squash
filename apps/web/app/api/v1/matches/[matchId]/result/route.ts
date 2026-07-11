import { submitMatchResultSchema } from '@squash/contracts';
import { submitMatchResult } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const PUT = playerRoute(
  async (actorId: string, request: Request, context: { params: Promise<{ matchId: string }> }) => {
    const { matchId } = await context.params;
    const input = submitMatchResultSchema.parse(await request.json());
    return dataResponse(
      await submitMatchResult(actorId, matchId, input.sets, input.revisionReason),
    );
  },
);

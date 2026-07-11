import { friendResponseSchema } from '@squash/contracts';
import { respondToFriend } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const PUT = playerRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ friendshipId: string }> },
  ) => {
    const { friendshipId } = await context.params;
    const { status } = friendResponseSchema.parse(await request.json());
    return dataResponse(await respondToFriend(actorId, friendshipId, status));
  },
);

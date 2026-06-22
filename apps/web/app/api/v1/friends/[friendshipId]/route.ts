import { friendResponseSchema } from '@squash/contracts';
import { respondToFriend } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function PUT(
  request: Request,
  context: { params: Promise<{ friendshipId: string }> },
) {
  try {
    const actorId = await requireUserId();
    const { friendshipId } = await context.params;
    const { status } = friendResponseSchema.parse(await request.json());
    return dataResponse(await respondToFriend(actorId, friendshipId, status));
  } catch (error) {
    return errorResponse(error);
  }
}

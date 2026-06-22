import { friendRequestSchema } from '@squash/contracts';
import { listFriends, requestFriend } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET() {
  try {
    const actorId = await requireUserId();
    return dataResponse(await listFriends(actorId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    const { addresseeId } = friendRequestSchema.parse(await request.json());
    return dataResponse(await requestFriend(actorId, addresseeId), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

import { friendRequestSchema } from '@squash/contracts';
import { listFriends, requestFriend } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string) => {
  return dataResponse(await listFriends(actorId));
});

export const POST = playerRoute(async (actorId: string, request: Request) => {
  const { addresseeId } = friendRequestSchema.parse(await request.json());
  return dataResponse(await requestFriend(actorId, addresseeId), 201);
});

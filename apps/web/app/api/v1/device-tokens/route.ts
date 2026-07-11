import { deviceTokenSchema } from '@squash/contracts';
import { registerDeviceToken } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const POST = playerRoute(async (actorId: string, request: Request) => {
  return dataResponse(
    await registerDeviceToken(actorId, deviceTokenSchema.parse(await request.json())),
    201,
  );
});

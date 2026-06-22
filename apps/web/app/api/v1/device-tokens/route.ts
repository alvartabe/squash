import { deviceTokenSchema } from '@squash/contracts';
import { registerDeviceToken } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    return dataResponse(
      await registerDeviceToken(actorId, deviceTokenSchema.parse(await request.json())),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

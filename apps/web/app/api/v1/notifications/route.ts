import { listNotifications } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET() {
  try {
    const actorId = await requireUserId();
    return dataResponse(await listNotifications(actorId));
  } catch (error) {
    return errorResponse(error);
  }
}

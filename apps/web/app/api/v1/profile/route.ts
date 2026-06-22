import { profileSchema } from '@squash/contracts';
import { updateProfile } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function PUT(request: Request) {
  try {
    const actorId = await requireUserId();
    return dataResponse(await updateProfile(actorId, profileSchema.parse(await request.json())));
  } catch (error) {
    return errorResponse(error);
  }
}

import { createOpenPlaySessionSchema } from '@squash/contracts';
import { createOpenPlay } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    const input = createOpenPlaySessionSchema.parse(await request.json());
    return dataResponse(await createOpenPlay(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

import { equipmentSchema } from '@squash/contracts';
import { createRacket, listRackets } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET() {
  try {
    const actorId = await requireUserId();
    return dataResponse(await listRackets(actorId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    return dataResponse(
      await createRacket(actorId, equipmentSchema.parse(await request.json())),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

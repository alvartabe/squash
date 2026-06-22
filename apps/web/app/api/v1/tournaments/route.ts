import { createTournamentSchema } from '@squash/contracts';
import { createTournament } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    const input = createTournamentSchema.parse(await request.json());
    return dataResponse(await createTournament(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

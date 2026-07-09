import { createTournamentSchema } from '@squash/contracts';
import { createTournament, listDiscoverableTournaments } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId, requireUserId } from '@/src/http';

export async function GET() {
  try {
    return dataResponse(await listDiscoverableTournaments(await requireUserId()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorId = await requireManagementUserId();
    const input = createTournamentSchema.parse(await request.json());
    return dataResponse(await createTournament(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

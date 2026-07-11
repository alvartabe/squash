import { createTournamentSchema } from '@squash/contracts';
import { createTournament, listDiscoverableTournaments } from '@squash/server';
import { dataResponse, managementRoute, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string) => {
  return dataResponse(await listDiscoverableTournaments(actorId));
});

export const POST = managementRoute(async (actorId: string, request: Request) => {
  const input = createTournamentSchema.parse(await request.json());
  return dataResponse(await createTournament(actorId, input), 201);
});

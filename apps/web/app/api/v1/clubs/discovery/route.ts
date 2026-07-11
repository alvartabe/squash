import { paginationQuerySchema } from '@squash/contracts';
import { listDiscoverableClubs } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string, request: Request) => {
  const query = paginationQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  return dataResponse(await listDiscoverableClubs(actorId, query));
});

import { clubListQuerySchema, createClubSchema } from '@squash/contracts';
import { createClub, listWorkspaceClubs } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const GET = managementRoute(async (actorId: string, request: Request) => {
  const query = clubListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  return dataResponse(await listWorkspaceClubs(actorId, query));
});

export const POST = managementRoute(async (actorId: string, request: Request) => {
  return dataResponse(await createClub(actorId, createClubSchema.parse(await request.json())), 201);
});

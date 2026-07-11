import { clubPlaySessionListQuerySchema } from '@squash/contracts';
import { listMyClubPlaySessions } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string, request: Request) => {
  const { scope } = clubPlaySessionListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  return dataResponse(await listMyClubPlaySessions(actorId, scope));
});

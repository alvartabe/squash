import { usernameDiscoveryQuerySchema } from '@squash/contracts';
import { findPlayerByExactUsername } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (_actorId: string, request: Request) => {
  const input = usernameDiscoveryQuerySchema.parse({
    username: new URL(request.url).searchParams.get('username') ?? undefined,
  });
  return dataResponse(await findPlayerByExactUsername(input.username));
});

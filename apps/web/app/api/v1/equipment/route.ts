import { equipmentSchema } from '@squash/contracts';
import { createRacket, listRackets } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const GET = playerRoute(async (actorId: string) => {
  return dataResponse(await listRackets(actorId));
});

export const POST = playerRoute(async (actorId: string, request: Request) => {
  return dataResponse(
    await createRacket(actorId, equipmentSchema.parse(await request.json())),
    201,
  );
});

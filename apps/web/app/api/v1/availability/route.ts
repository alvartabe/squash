import { recurringAvailabilitySchema } from '@squash/contracts';
import { getAvailability, replaceAvailability } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';
import { z } from 'zod';

export const GET = playerRoute(async (actorId: string) => {
  return dataResponse(await getAvailability(actorId));
});

export const PUT = playerRoute(async (actorId: string, request: Request) => {
  const windows = z
    .array(recurringAvailabilitySchema)
    .max(50)
    .parse(await request.json());
  return dataResponse(await replaceAvailability(actorId, windows));
});

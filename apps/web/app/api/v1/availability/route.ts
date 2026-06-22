import { recurringAvailabilitySchema } from '@squash/contracts';
import { getAvailability, replaceAvailability } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';
import { z } from 'zod';

export async function GET() {
  try {
    const actorId = await requireUserId();
    return dataResponse(await getAvailability(actorId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actorId = await requireUserId();
    const windows = z
      .array(recurringAvailabilitySchema)
      .max(50)
      .parse(await request.json());
    return dataResponse(await replaceAvailability(actorId, windows));
  } catch (error) {
    return errorResponse(error);
  }
}

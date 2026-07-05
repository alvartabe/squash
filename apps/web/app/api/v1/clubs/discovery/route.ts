import { paginationQuerySchema } from '@squash/contracts';
import { listDiscoverableClubs } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET(request: Request) {
  try {
    const actorId = await requireUserId();
    const query = paginationQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listDiscoverableClubs(actorId, query));
  } catch (error) {
    return errorResponse(error);
  }
}

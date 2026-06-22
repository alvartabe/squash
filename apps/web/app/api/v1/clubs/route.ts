import { clubListQuerySchema, createClubSchema } from '@squash/contracts';
import { createClub, listWorkspaceClubs } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET(request: Request) {
  try {
    const actorId = await requireUserId();
    const query = clubListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listWorkspaceClubs(actorId, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actorId = await requireUserId();
    return dataResponse(
      await createClub(actorId, createClubSchema.parse(await request.json())),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

import {
  clubPlaySessionListQuerySchema,
  createClubPlaySessionSchema,
  idSchema,
} from '@squash/contracts';
import { createClubPlaySession, listClubPlaySessionsForManagement } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId } = await params;
    const { scope } = clubPlaySessionListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(
      await listClubPlaySessionsForManagement(actorId, idSchema.parse(clubId), scope),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
    const { clubId } = await params;
    const input = createClubPlaySessionSchema.parse({
      ...(await request.json()),
      clubId: idSchema.parse(clubId),
    });
    return dataResponse(await createClubPlaySession(actorId, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}

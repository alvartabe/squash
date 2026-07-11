import {
  clubPlaySessionListQuerySchema,
  createClubPlaySessionSchema,
  idSchema,
} from '@squash/contracts';
import { createClubPlaySession, listClubPlaySessionsForManagement } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const GET = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    const { scope } = clubPlaySessionListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(
      await listClubPlaySessionsForManagement(actorId, idSchema.parse(clubId), scope),
    );
  },
);

export const POST = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    const input = createClubPlaySessionSchema.parse({
      ...(await request.json()),
      clubId: idSchema.parse(clubId),
    });
    return dataResponse(await createClubPlaySession(actorId, input), 201);
  },
);

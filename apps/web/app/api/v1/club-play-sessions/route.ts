import { clubPlaySessionListQuerySchema } from '@squash/contracts';
import { listMyClubPlaySessions } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET(request: Request) {
  try {
    const actorId = await requireUserId();
    const { scope } = clubPlaySessionListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listMyClubPlaySessions(actorId, scope));
  } catch (error) {
    return errorResponse(error);
  }
}

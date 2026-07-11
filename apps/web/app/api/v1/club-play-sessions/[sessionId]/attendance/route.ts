import { idSchema, updateAttendanceResponseSchema } from '@squash/contracts';
import { setClubPlaySessionAttendance } from '@squash/server';
import { dataResponse, playerRoute } from '@/src/http';

export const PUT = playerRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
  ) => {
    const { sessionId } = await context.params;
    return dataResponse(
      await setClubPlaySessionAttendance(
        actorId,
        idSchema.parse(sessionId),
        updateAttendanceResponseSchema.parse(await request.json()),
      ),
    );
  },
);

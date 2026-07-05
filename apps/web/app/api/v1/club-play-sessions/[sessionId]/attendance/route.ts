import { idSchema, updateAttendanceResponseSchema } from '@squash/contracts';
import { setClubPlaySessionAttendance } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function PUT(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actorId = await requireUserId();
    const { sessionId } = await context.params;
    return dataResponse(
      await setClubPlaySessionAttendance(
        actorId,
        idSchema.parse(sessionId),
        updateAttendanceResponseSchema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

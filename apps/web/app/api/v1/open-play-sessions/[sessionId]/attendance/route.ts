import { updateAttendanceSchema } from '@squash/contracts';
import { setOpenPlayAttendance } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function PUT(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actorId = await requireUserId();
    const { sessionId } = await context.params;
    const { status } = updateAttendanceSchema.parse(await request.json());
    return dataResponse(await setOpenPlayAttendance(actorId, sessionId, status));
  } catch (error) {
    return errorResponse(error);
  }
}

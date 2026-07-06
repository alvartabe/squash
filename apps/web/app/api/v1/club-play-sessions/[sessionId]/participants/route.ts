import { idSchema, inviteClubPlaySessionParticipantsSchema } from '@squash/contracts';
import {
  inviteClubPlaySessionParticipants,
  listClubPlaySessionInviteCandidates,
} from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actorId = await requireManagementUserId();
    const { sessionId } = await context.params;
    return dataResponse(
      await inviteClubPlaySessionParticipants(
        actorId,
        idSchema.parse(sessionId),
        inviteClubPlaySessionParticipantsSchema.parse(await request.json()),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actorId = await requireManagementUserId();
    const { sessionId } = await context.params;
    return dataResponse(
      await listClubPlaySessionInviteCandidates(actorId, idSchema.parse(sessionId)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

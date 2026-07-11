import { idSchema, inviteClubPlaySessionParticipantsSchema } from '@squash/contracts';
import {
  inviteClubPlaySessionParticipants,
  listClubPlaySessionInviteCandidates,
} from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
  ) => {
    const { sessionId } = await context.params;
    return dataResponse(
      await inviteClubPlaySessionParticipants(
        actorId,
        idSchema.parse(sessionId),
        inviteClubPlaySessionParticipantsSchema.parse(await request.json()),
      ),
      201,
    );
  },
);

export const GET = managementRoute(
  async (
    actorId: string,
    _request: Request,
    context: { params: Promise<{ sessionId: string }> },
  ) => {
    const { sessionId } = await context.params;
    return dataResponse(
      await listClubPlaySessionInviteCandidates(actorId, idSchema.parse(sessionId)),
    );
  },
);

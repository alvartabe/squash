import { idSchema } from '@squash/contracts';
import { revokeClubInvitation } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string; invitationId: string }> };

export const DELETE = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { clubId, invitationId } = await params;
    return dataResponse(
      await revokeClubInvitation(actorId, idSchema.parse(clubId), idSchema.parse(invitationId)),
    );
  },
);

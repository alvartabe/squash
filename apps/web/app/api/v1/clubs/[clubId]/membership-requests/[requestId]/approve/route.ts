import { idSchema } from '@squash/contracts';
import { approveMembershipRequest } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string; requestId: string }> };

export const POST = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { clubId, requestId } = await params;
    return dataResponse(
      await approveMembershipRequest(actorId, idSchema.parse(clubId), idSchema.parse(requestId)),
    );
  },
);

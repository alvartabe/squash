import { idSchema, transferClubOwnershipSchema } from '@squash/contracts';
import { transferClubOwnership } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const POST = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    const input = transferClubOwnershipSchema.parse(await request.json());
    return dataResponse(await transferClubOwnership(actorId, idSchema.parse(clubId), input.userId));
  },
);

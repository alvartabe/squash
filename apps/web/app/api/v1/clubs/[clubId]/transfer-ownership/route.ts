import { idSchema, transferClubOwnershipSchema } from '@squash/contracts';
import { transferClubOwnership } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId } = await params;
    const input = transferClubOwnershipSchema.parse(await request.json());
    return dataResponse(await transferClubOwnership(actorId, idSchema.parse(clubId), input.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

import { idSchema, inviteClubMemberSchema, paginationQuerySchema } from '@squash/contracts';
import { inviteClubMember, listClubInvitations } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId } = await params;
    const query = paginationQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listClubInvitations(actorId, idSchema.parse(clubId), query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const actorId = await requireUserId();
    const { clubId } = await params;
    return dataResponse(
      await inviteClubMember(
        actorId,
        idSchema.parse(clubId),
        inviteClubMemberSchema.parse(await request.json()),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

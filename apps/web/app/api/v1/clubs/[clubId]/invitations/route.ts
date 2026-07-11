import { idSchema, inviteClubMemberSchema, paginationQuerySchema } from '@squash/contracts';
import { inviteClubMember, listClubInvitations } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string }> };

export const GET = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    const query = paginationQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return dataResponse(await listClubInvitations(actorId, idSchema.parse(clubId), query));
  },
);

export const POST = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId } = await params;
    return dataResponse(
      await inviteClubMember(
        actorId,
        idSchema.parse(clubId),
        inviteClubMemberSchema.parse(await request.json()),
      ),
      201,
    );
  },
);

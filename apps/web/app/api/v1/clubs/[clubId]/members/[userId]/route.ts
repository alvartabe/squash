import { idSchema, updateClubMemberSchema, userIdSchema } from '@squash/contracts';
import { removeClubMember, updateClubMembership } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string; userId: string }> };

export const PATCH = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId, userId } = await params;
    const input = updateClubMemberSchema.parse(await request.json());
    const parsedClubId = idSchema.parse(clubId);
    const parsedUserId = userIdSchema.parse(userId);
    return dataResponse(
      await updateClubMembership(actorId, parsedClubId, parsedUserId, {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.responsibilities === undefined
          ? {}
          : { responsibilities: input.responsibilities }),
      }),
    );
  },
);

export const DELETE = managementRoute(
  async (actorId: string, _request: Request, { params }: Context) => {
    const { clubId, userId } = await params;
    return dataResponse(
      await removeClubMember(actorId, idSchema.parse(clubId), userIdSchema.parse(userId)),
    );
  },
);

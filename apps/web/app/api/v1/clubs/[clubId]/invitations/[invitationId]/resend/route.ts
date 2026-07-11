import { idSchema, localeSchema } from '@squash/contracts';
import { resendClubInvitation } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

type Context = { params: Promise<{ clubId: string; invitationId: string }> };

export const POST = managementRoute(
  async (actorId: string, request: Request, { params }: Context) => {
    const { clubId, invitationId } = await params;
    const body = (await request.json().catch(() => ({}))) as { locale?: string };
    return dataResponse(
      await resendClubInvitation(
        actorId,
        idSchema.parse(clubId),
        idSchema.parse(invitationId),
        localeSchema.parse(body.locale ?? 'en-US'),
      ),
    );
  },
);

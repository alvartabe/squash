import { idSchema, localeSchema } from '@squash/contracts';
import { resendClubInvitation } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

type Context = { params: Promise<{ clubId: string; invitationId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actorId = await requireManagementUserId();
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
  } catch (error) {
    return errorResponse(error);
  }
}

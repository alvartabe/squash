import { acceptClubInvitation } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

type Context = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const { token } = await params;
    return dataResponse(await acceptClubInvitation(await requireUserId(), token));
  } catch (error) {
    return errorResponse(error);
  }
}

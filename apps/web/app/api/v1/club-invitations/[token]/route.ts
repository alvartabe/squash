import { getClubInvitation } from '@squash/server';
import { dataResponse, errorResponse } from '@/src/http';

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { token } = await params;
    return dataResponse(await getClubInvitation(token));
  } catch (error) {
    return errorResponse(error);
  }
}

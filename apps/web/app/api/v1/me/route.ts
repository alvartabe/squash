import { getCurrentWorkspaceUser } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET() {
  try {
    return dataResponse(await getCurrentWorkspaceUser(await requireUserId()));
  } catch (error) {
    return errorResponse(error);
  }
}

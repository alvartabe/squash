import { getCurrentWorkspaceUser } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function GET() {
  try {
    return dataResponse(await getCurrentWorkspaceUser(await requireManagementUserId()));
  } catch (error) {
    return errorResponse(error);
  }
}

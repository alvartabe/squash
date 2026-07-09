import { listClubTournaments } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function GET(_request: Request, context: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await context.params;
    return dataResponse(await listClubTournaments(await requireManagementUserId(), clubId));
  } catch (error) {
    return errorResponse(error);
  }
}

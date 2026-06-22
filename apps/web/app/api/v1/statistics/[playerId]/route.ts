import { getPlayerStatistics } from '@squash/server';
import { dataResponse, errorResponse, requireUserId } from '@/src/http';

export async function GET(_request: Request, context: { params: Promise<{ playerId: string }> }) {
  try {
    await requireUserId();
    const { playerId } = await context.params;
    return dataResponse(await getPlayerStatistics(playerId));
  } catch (error) {
    return errorResponse(error);
  }
}

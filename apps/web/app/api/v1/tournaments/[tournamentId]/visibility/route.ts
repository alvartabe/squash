import { updateTournamentVisibilitySchema } from '@squash/contracts';
import { updateTournamentVisibility } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tournamentId: string }> },
) {
  try {
    const { tournamentId } = await context.params;
    const input = updateTournamentVisibilitySchema.parse(await request.json());
    return dataResponse(
      await updateTournamentVisibility(
        await requireManagementUserId(),
        tournamentId,
        input.visibility,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

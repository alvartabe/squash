import { officialResultInputSchema } from '@squash/contracts';
import { recordOfficialTournamentResult } from '@squash/server';
import { dataResponse, errorResponse, requireManagementUserId } from '@/src/http';

export async function POST(
  request: Request,
  context: { params: Promise<{ tournamentId: string; fixtureId: string }> },
) {
  try {
    const { tournamentId, fixtureId } = await context.params;
    const input = officialResultInputSchema.parse(await request.json());
    return dataResponse(
      await recordOfficialTournamentResult(
        await requireManagementUserId(),
        tournamentId,
        fixtureId,
        input,
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

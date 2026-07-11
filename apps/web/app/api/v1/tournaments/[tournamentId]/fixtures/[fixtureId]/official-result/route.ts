import { officialResultInputSchema } from '@squash/contracts';
import { recordOfficialTournamentResult } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string; fixtureId: string }> },
  ) => {
    const { tournamentId, fixtureId } = await context.params;
    const input = officialResultInputSchema.parse(await request.json());
    return dataResponse(
      await recordOfficialTournamentResult(actorId, tournamentId, fixtureId, input),
      201,
    );
  },
);

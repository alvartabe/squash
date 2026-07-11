import { parseOfficialResultInput, recordOfficialTournamentResult } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const POST = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string; fixtureId: string }> },
  ) => {
    const { tournamentId, fixtureId } = await context.params;
    const input = parseOfficialResultInput(await request.json());
    return dataResponse(
      await recordOfficialTournamentResult(actorId, tournamentId, fixtureId, input),
      201,
    );
  },
);

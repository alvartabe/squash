import { updateTournamentFixtureScheduleSchema } from '@squash/contracts';
import { updateTournamentFixtureSchedule } from '@squash/server';
import { dataResponse, managementRoute } from '@/src/http';

export const PATCH = managementRoute(
  async (
    actorId: string,
    request: Request,
    context: { params: Promise<{ tournamentId: string; fixtureId: string }> },
  ) => {
    const { tournamentId, fixtureId } = await context.params;
    const input = updateTournamentFixtureScheduleSchema.parse(await request.json());
    return dataResponse(
      await updateTournamentFixtureSchedule(actorId, tournamentId, fixtureId, input),
    );
  },
);

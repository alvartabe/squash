import { updateTournamentFixtureSchedule } from '@squash/server';
import { PATCH } from '../app/api/v1/tournaments/[tournamentId]/fixtures/[fixtureId]/schedule/route';

jest.mock('@squash/server', () => ({ updateTournamentFixtureSchedule: jest.fn() }));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown) => ({ json: async () => ({ data }) }),
  managementRoute:
    (handler: (actorId: string, request: Request, context: unknown) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler('organizer-id', request, context),
}));

const mockUpdateSchedule = updateTournamentFixtureSchedule as jest.Mock;

describe('PATCH /api/v1/tournaments/:tournamentId/fixtures/:fixtureId/schedule', () => {
  it('uses management authentication and the Fixture Schedule contract', async () => {
    const input = {
      scheduledAt: '2026-08-02T09:00:00-06:00',
      venueText: 'Glass Court',
      courtLabel: 'Court 1',
    };
    mockUpdateSchedule.mockResolvedValueOnce({ fixtureId: 'fixture-id', ...input });

    const response = await PATCH({ json: async () => input } as Request, {
      params: Promise.resolve({ tournamentId: 'tournament-id', fixtureId: 'fixture-id' }),
    });

    expect(mockUpdateSchedule).toHaveBeenCalledWith(
      'organizer-id',
      'tournament-id',
      'fixture-id',
      input,
    );
    await expect(response.json()).resolves.toEqual({ data: { fixtureId: 'fixture-id', ...input } });
  });
});

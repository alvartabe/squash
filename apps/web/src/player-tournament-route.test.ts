import { getOfficialTournamentPlayerDetail } from '@squash/server';
import { GET } from '../app/api/v1/tournaments/[tournamentId]/route';

jest.mock('@squash/server', () => ({ getOfficialTournamentPlayerDetail: jest.fn() }));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown) => ({ json: async () => ({ data }) }),
  playerRoute:
    (handler: (actorId: string, request: Request, context: unknown) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler('authenticated-player-id', request, context),
}));

const mockGetDetail = getOfficialTournamentPlayerDetail as jest.Mock;

describe('GET /api/v1/tournaments/:tournamentId', () => {
  it('uses Player authentication and returns the Player-specific Official Tournament projection', async () => {
    const detail = {
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      status: 'knockout',
      groups: [],
      knockoutDraw: [],
      champion: null,
    };
    mockGetDetail.mockResolvedValueOnce(detail);

    const response = await GET({} as Request, {
      params: Promise.resolve({ tournamentId: 'tournament-id' }),
    });

    expect(mockGetDetail).toHaveBeenCalledWith('authenticated-player-id', 'tournament-id');
    await expect(response.json()).resolves.toEqual({ data: detail });
  });
});

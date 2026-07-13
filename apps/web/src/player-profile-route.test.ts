import { getPlayerProfile, updateProfile } from '@squash/server';
import { GET, PUT } from '../app/api/v1/profile/route';

jest.mock('@squash/server', () => ({
  getPlayerProfile: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown) => ({ json: async () => ({ data }) }),
  playerRoute:
    (handler: (actorId: string, request: Request) => Promise<Response>) => (request: Request) =>
      handler('authenticated-player-id', request),
}));

const profile = {
  username: 'maria.solis',
  name: 'María Solís',
  bio: 'Squash player',
  dominantHand: 'right' as const,
  visibility: 'shared-clubs' as const,
  locale: 'es-419' as const,
  timeZone: 'America/Costa_Rica',
};

describe('/api/v1/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns only the authenticated Player profile', async () => {
    (getPlayerProfile as jest.Mock).mockResolvedValueOnce(profile);

    const response = await GET({} as Request, {});

    expect(getPlayerProfile).toHaveBeenCalledWith('authenticated-player-id');
    await expect(response.json()).resolves.toEqual({ data: profile });
  });

  it('validates and saves the authenticated Player profile', async () => {
    (updateProfile as jest.Mock).mockResolvedValueOnce(profile);

    const response = await PUT({ json: async () => profile } as Request, {});

    expect(updateProfile).toHaveBeenCalledWith('authenticated-player-id', profile);
    await expect(response.json()).resolves.toEqual({ data: profile });
  });
});

import { findPlayerByExactUsername } from '@squash/server';
import { GET } from '../app/api/v1/players/discovery/route';

jest.mock('@squash/server', () => ({ findPlayerByExactUsername: jest.fn() }));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown) => ({ json: async () => ({ data }) }),
  playerRoute:
    (handler: (actorId: string, request: Request) => Promise<Response>) => (request: Request) =>
      handler('authenticated-player-id', request),
}));

describe('/api/v1/players/discovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the exact Username through an authenticated Player route', async () => {
    const match = { username: 'Maria.Solis', displayName: 'María Solís', avatar: null };
    (findPlayerByExactUsername as jest.Mock).mockResolvedValueOnce(match);

    const response = await GET(
      { url: 'http://localhost/api/v1/players/discovery?username=Maria.Solis' } as Request,
      {},
    );

    expect(findPlayerByExactUsername).toHaveBeenCalledWith('Maria.Solis');
    await expect(response.json()).resolves.toEqual({ data: match });
  });

  it('returns a null data result when there is no exact match', async () => {
    (findPlayerByExactUsername as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(
      { url: 'http://localhost/api/v1/players/discovery?username=missing' } as Request,
      {},
    );
    await expect(response.json()).resolves.toEqual({ data: null });
  });
});

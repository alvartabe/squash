import { reactivatePlayer, suspendPlayer } from '@squash/server';
import { DELETE, POST } from '../app/api/v1/platform/players/[playerId]/suspension/route';

jest.mock('@squash/server', () => ({
  suspendPlayer: jest.fn(),
  reactivatePlayer: jest.fn(),
}));
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown) => ({ json: async () => ({ data }) }),
  managementRoute:
    (handler: (actorId: string, request: Request, context: unknown) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler('platform-admin-id', request, context),
}));

const playerId = 'target-player-id';
const context = { params: Promise.resolve({ playerId }) };

describe('/api/v1/platform/players/:playerId/suspension', () => {
  beforeEach(() => jest.clearAllMocks());

  it('suspends the explicit Player ID using the management-authenticated actor', async () => {
    const result = {
      playerId,
      state: 'suspended',
      suspendedAt: '2026-07-13T15:00:00.000Z',
      transitioned: true,
    };
    (suspendPlayer as jest.Mock).mockResolvedValueOnce(result);

    const response = await POST({} as Request, context);

    expect(suspendPlayer).toHaveBeenCalledWith('platform-admin-id', playerId);
    await expect(response.json()).resolves.toEqual({ data: result });
  });

  it('reactivates the explicit Player ID without accepting a directory or profile payload', async () => {
    const result = {
      playerId,
      state: 'active',
      suspendedAt: null,
      transitioned: true,
    };
    (reactivatePlayer as jest.Mock).mockResolvedValueOnce(result);

    const response = await DELETE({} as Request, context);

    expect(reactivatePlayer).toHaveBeenCalledWith('platform-admin-id', playerId);
    await expect(response.json()).resolves.toEqual({ data: result });
  });
});

import {
  requireActivePlatformAccount,
  requireManagementAuthentication,
  ServiceError,
  suspendPlayer,
} from '@squash/server';
import { auth, managementAuth } from '@squash/server/auth';
import { POST as suspendRoute } from '../app/api/v1/platform/players/[playerId]/suspension/route';
import { requireManagementUserId, requireUserId } from './http';

jest.mock('next/headers', () => ({ headers: jest.fn().mockResolvedValue(new Headers()) }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
jest.mock('better-auth/api', () => ({ isAPIError: () => false }));
jest.mock('@squash/server/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
  managementAuth: { api: { getSession: jest.fn() } },
}));
jest.mock('@squash/server', () => ({
  requireActivePlatformAccount: jest.fn(),
  requireManagementAuthentication: jest.fn(),
  suspendPlayer: jest.fn(),
  reactivatePlayer: jest.fn(),
  ServiceError: class ServiceError extends Error {
    constructor(
      public readonly code: string,
      public readonly messageKey: string,
      public readonly status: number,
    ) {
      super(code);
    }
  },
}));

const mockPlayerSession = auth.api.getSession as unknown as jest.Mock;
const mockManagementSession = managementAuth.api.getSession as unknown as jest.Mock;
const mockRequireActivePlatformAccount = requireActivePlatformAccount as jest.Mock;
const mockRequireManagementAuthentication = requireManagementAuthentication as jest.Mock;
const mockSuspendPlayer = suspendPlayer as jest.Mock;

describe('centralized Platform Suspension authentication boundaries', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'request-id' },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayerSession.mockResolvedValue({ user: { id: 'player-id' } });
    mockManagementSession.mockResolvedValue({ user: { id: 'manager-id' } });
    mockRequireActivePlatformAccount.mockResolvedValue({ id: 'player-id' });
    mockRequireManagementAuthentication.mockResolvedValue({ userId: 'manager-id' });
  });

  it('rechecks persisted state and rejects a stale Player session', async () => {
    mockRequireActivePlatformAccount.mockRejectedValueOnce(
      new ServiceError('ACCOUNT_SUSPENDED', 'error.accountSuspended', 403),
    );

    await expect(requireUserId()).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
      status: 403,
    });
    expect(mockRequireActivePlatformAccount).toHaveBeenCalledWith('player-id');
  });

  it('rechecks persisted state and rejects a stale management session', async () => {
    mockRequireManagementAuthentication.mockRejectedValueOnce(
      new ServiceError('ACCOUNT_SUSPENDED', 'error.accountSuspended', 403),
    );

    await expect(requireManagementUserId()).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
      status: 403,
    });
    expect(mockRequireManagementAuthentication).toHaveBeenCalledWith('manager-id', null);
  });

  it('does not treat a Player/OAuth session as an assured management session', async () => {
    mockManagementSession.mockResolvedValueOnce(null);
    mockRequireManagementAuthentication.mockRejectedValueOnce(
      new ServiceError('MFA_VERIFICATION_REQUIRED', 'error.mfaVerificationRequired', 403),
    );

    await expect(requireManagementUserId()).rejects.toMatchObject({
      code: 'MFA_VERIFICATION_REQUIRED',
      status: 403,
    });
    expect(mockRequireManagementAuthentication).toHaveBeenCalledWith(null, 'player-id');
  });

  it('rejects a Player/OAuth session at the composed suspension API boundary', async () => {
    mockManagementSession.mockResolvedValueOnce(null);
    mockRequireManagementAuthentication.mockRejectedValueOnce(
      new ServiceError('MFA_VERIFICATION_REQUIRED', 'error.mfaVerificationRequired', 403),
    );

    const response = await suspendRoute({} as Request, {
      params: Promise.resolve({ playerId: 'target-player-id' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'MFA_VERIFICATION_REQUIRED' },
    });
    expect(mockSuspendPlayer).not.toHaveBeenCalled();
  });

  it('allows an assured management session through the composed suspension API boundary', async () => {
    mockSuspendPlayer.mockResolvedValueOnce({
      playerId: 'target-player-id',
      state: 'suspended',
      suspendedAt: '2026-07-13T15:00:00.000Z',
      transitioned: true,
    });

    const response = await suspendRoute({} as Request, {
      params: Promise.resolve({ playerId: 'target-player-id' }),
    });

    expect(response.status).toBe(200);
    expect(mockRequireManagementAuthentication).toHaveBeenCalledWith('manager-id', null);
    expect(mockSuspendPlayer).toHaveBeenCalledWith('manager-id', 'target-player-id');
  });
});

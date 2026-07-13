import {
  requireManagementAuthentication,
  requirePlatformAdmin,
  ServiceError,
} from '@squash/server';
import { managementAuth } from '@squash/server/auth';
import PlatformAuditPage from '../app/workspace/platform/audit/page';

const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockRedirect = jest.fn((location: string) => {
  throw new Error(`NEXT_REDIRECT:${location}`);
});

jest.mock('next/headers', () => ({ headers: jest.fn().mockResolvedValue(new Headers()) }));
jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (location: string) => mockRedirect(location),
}));
jest.mock('@squash/server/auth', () => ({
  managementAuth: { api: { getSession: jest.fn() } },
}));
jest.mock('@squash/server', () => ({
  requireManagementAuthentication: jest.fn(),
  requirePlatformAdmin: jest.fn(),
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
jest.mock('@/components/platform/audit-index', () => ({ AuditIndex: () => null }));

const mockGetSession = managementAuth.api.getSession as unknown as jest.Mock;
const mockRequireManagementAuthentication = requireManagementAuthentication as jest.Mock;
const mockRequirePlatformAdmin = requirePlatformAdmin as jest.Mock;

describe('/workspace/platform/audit access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'platform-admin-id' } });
    mockRequireManagementAuthentication.mockResolvedValue({ userId: 'platform-admin-id' });
    mockRequirePlatformAdmin.mockResolvedValue({ role: 'platform-admin' });
  });

  it('requires the centralized assured management boundary and current Platform authority', async () => {
    await expect(PlatformAuditPage()).resolves.toMatchObject({ type: expect.any(Function) });
    expect(mockRequireManagementAuthentication).toHaveBeenCalledWith('platform-admin-id', null);
    expect(mockRequirePlatformAdmin).toHaveBeenCalledWith('platform-admin-id');
  });

  it('does not render for a non-Platform management user', async () => {
    mockRequirePlatformAdmin.mockRejectedValueOnce(
      new ServiceError('FORBIDDEN', 'error.forbidden', 403),
    );

    await expect(PlatformAuditPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('does not accept an absent management session, including a Player/OAuth-only session', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(PlatformAuditPage()).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackURL=/workspace/platform/audit',
    );
    expect(mockRequireManagementAuthentication).not.toHaveBeenCalled();
    expect(mockRequirePlatformAdmin).not.toHaveBeenCalled();
  });
});

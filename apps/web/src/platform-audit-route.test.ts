import { listPlatformAuditRecords } from '@squash/server';
import { GET } from '../app/api/v1/platform/audit/route';

jest.mock('@squash/server', () => ({
  listPlatformAuditRecords: jest.fn(),
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
jest.mock('@/src/http', () => ({
  dataResponse: (data: unknown) => ({ json: async () => ({ data }) }),
  managementRoute:
    (handler: (actorId: string, request: Request, context: unknown) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler('platform-admin-id', request, context),
}));

const mockListPlatformAuditRecords = listPlatformAuditRecords as jest.Mock;
const auditRecord = {
  id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
  createdAt: '2026-07-12T15:00:00.123Z',
  action: 'club.archived',
  actorId: null,
  entityType: 'club',
  entityId: '6ed6b0ac-c7a6-4c64-9d20-496f18f901ab',
  clubId: null,
};

describe('GET /api/v1/platform/audit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the management-authenticated actor and returns only the audit projection', async () => {
    mockListPlatformAuditRecords.mockResolvedValueOnce({ items: [auditRecord], nextCursor: null });

    const response = await GET({ url: 'http://localhost/api/v1/platform/audit' } as Request, {});

    expect(mockListPlatformAuditRecords).toHaveBeenCalledWith('platform-admin-id', {});
    const body = await response.json();
    expect(body).toEqual({ data: { items: [auditRecord], nextCursor: null } });
    expect(JSON.stringify(body)).not.toContain('metadata');
  });

  it('passes only the opaque cursor and does not expose client-controlled page sizing', async () => {
    mockListPlatformAuditRecords.mockResolvedValueOnce({ items: [], nextCursor: null });

    await GET(
      {
        url: 'http://localhost/api/v1/platform/audit?cursor=opaque-cursor&pageSize=1',
      } as Request,
      {},
    );

    expect(mockListPlatformAuditRecords).toHaveBeenCalledWith('platform-admin-id', {
      cursor: 'opaque-cursor',
    });
  });

  it('returns the stable validation error for a malformed public cursor', async () => {
    await expect(
      GET({ url: 'http://localhost/api/v1/platform/audit?cursor=' } as Request, {}),
    ).rejects.toMatchObject({
      code: 'INVALID_AUDIT_CURSOR',
      messageKey: 'error.invalidAuditCursor',
      status: 400,
    });
    expect(mockListPlatformAuditRecords).not.toHaveBeenCalled();
  });
});

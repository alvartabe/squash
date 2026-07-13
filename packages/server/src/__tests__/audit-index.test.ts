import { requirePlatformAdmin } from '../authorization';
import { db } from '../database';
import { listPlatformAuditRecords, projectAuditRecord } from '../audit-index';
import { forbidden } from '../errors';

jest.mock('../authorization', () => ({ requirePlatformAdmin: jest.fn() }));
jest.mock('../database', () => ({ db: { select: jest.fn() } }));

const mockRequirePlatformAdmin = requirePlatformAdmin as jest.Mock;
const mockDb = db as unknown as { select: jest.Mock };
const auditId = '91f6704a-c62c-4676-93a1-72d5b3fd6b7a';
const clubId = '6ed6b0ac-c7a6-4c64-9d20-496f18f901ab';

function cursorWithTimestamp(createdAt: string) {
  return Buffer.from(JSON.stringify({ version: 1, createdAt, id: auditId }), 'utf8').toString(
    'base64url',
  );
}

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: auditId,
    actorId: 'platform-admin-id',
    clubId,
    action: 'club.archived',
    entityType: 'club',
    entityId: clubId,
    createdAt: new Date('2026-07-12T15:00:00.123Z'),
    cursorCreatedAt: '2026-07-12 15:00:00.123456+00',
    metadata: { privateEmail: 'private@example.com' },
    ...overrides,
  };
}

function mockList(rows: ReturnType<typeof auditRow>[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
  return { where, orderBy, limit };
}

describe('Platform Administrator audit index service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePlatformAdmin.mockResolvedValue({ role: 'platform-admin' });
  });

  it('projects only the approved public fields and accepts missing historical references', () => {
    expect(projectAuditRecord(auditRow({ actorId: null, clubId: null }))).toEqual({
      id: auditId,
      createdAt: '2026-07-12T15:00:00.123Z',
      action: 'club.archived',
      actorId: null,
      entityType: 'club',
      entityId: clubId,
      clubId: null,
    });
  });

  it('shows Platform Suspension evidence through the safe projection without raw transition metadata', () => {
    const projected = projectAuditRecord(
      auditRow({
        clubId: null,
        action: 'platform.account.suspend',
        entityType: 'player',
        entityId: 'target-player-id',
        metadata: { transition: 'suspended', privateProfile: 'must-not-leak' },
      }),
    );
    expect(projected).toMatchObject({
      action: 'platform.account.suspend',
      actorId: 'platform-admin-id',
      entityType: 'player',
      entityId: 'target-player-id',
      clubId: null,
    });
    expect(projected).not.toHaveProperty('metadata');
    expect(JSON.stringify(projected)).not.toContain('must-not-leak');
  });

  it('rechecks current Platform Administrator authority before reading records', async () => {
    mockRequirePlatformAdmin.mockRejectedValueOnce(forbidden());

    await expect(listPlatformAuditRecords('club-owner-id')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it.each(['Club Owner', 'Club Administrator', 'Coach', 'ordinary Player'])(
    'forbids a %s even when a management actor ID reaches the service',
    async () => {
      mockRequirePlatformAdmin.mockRejectedValueOnce(forbidden());

      await expect(listPlatformAuditRecords('non-platform-id')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        status: 403,
      });
      expect(mockDb.select).not.toHaveBeenCalled();
    },
  );

  it('returns the approved projection without raw metadata', async () => {
    mockList([auditRow()]);

    const page = await listPlatformAuditRecords('platform-admin-id');

    expect(mockRequirePlatformAdmin).toHaveBeenCalledWith('platform-admin-id');
    expect(page).toEqual({
      items: [
        {
          id: auditId,
          createdAt: '2026-07-12T15:00:00.123Z',
          action: 'club.archived',
          actorId: 'platform-admin-id',
          entityType: 'club',
          entityId: clubId,
          clubId,
        },
      ],
      nextCursor: null,
    });
    expect(JSON.stringify(page)).not.toContain('metadata');
    expect(JSON.stringify(page)).not.toContain('private@example.com');
  });

  it.each(['not-base64!', 'e30', '', cursorWithTimestamp('04 DecFoo 1995')])(
    'returns a stable error for malformed cursor %p',
    async (cursor) => {
      await expect(listPlatformAuditRecords('platform-admin-id', { cursor })).rejects.toMatchObject(
        {
          code: 'INVALID_AUDIT_CURSOR',
          messageKey: 'error.invalidAuditCursor',
          status: 400,
        },
      );
      expect(mockDb.select).not.toHaveBeenCalled();
    },
  );
});

import {
  auditLogs,
  clubInvitations,
  clubMemberships,
  clubResponsibilities,
  clubs,
  membershipRequests,
  clubPlaySessions,
  tournaments,
} from '@squash/db/schema';
import type { SQLWrapper } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { requireLockedClubAction } from '../authorization';
import { archiveWorkspaceClub, restoreWorkspaceClub } from '../club-admin';
import { db } from '../database';

jest.mock('../database', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireClubAccess: jest.fn(),
  requireClubAction: jest.fn(),
  requireLockedActiveClub: jest.fn(),
  requireLockedClubAction: jest.fn(),
  requirePlatformAdmin: jest.fn(),
  requireRegisteredPlayer: jest.fn(),
}));

const mockDb = db as unknown as { transaction: jest.Mock };
const mockRequireLockedClubAction = requireLockedClubAction as jest.Mock;
const dialect = new PgDialect();

type UpdateRecord = {
  table: unknown;
  values: Record<string, unknown>;
  condition: unknown;
};

function lifecycleTransaction(input?: {
  blockingTournaments?: Array<{ id: string; status: 'group-stage' | 'knockout' }>;
  failTable?: unknown;
}) {
  const updates: UpdateRecord[] = [];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const rows = new Map<unknown, Array<{ id: string }>>([
    [membershipRequests, [{ id: 'pending-request-id' }]],
    [clubInvitations, [{ id: 'pending-invitation-id' }]],
    [clubPlaySessions, [{ id: 'future-session-id' }]],
    [tournaments, [{ id: 'draft-tournament-id' }, { id: 'registration-tournament-id' }]],
    [clubs, [{ id: 'club-id' }]],
  ]);
  const tx = {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({
          for: async () => input?.blockingTournaments ?? [],
        }),
      }),
    })),
    update: jest.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            updates.push({ table, values, condition });
            if (table === input?.failTable) throw new Error('cascade failed');
            return rows.get(table) ?? [];
          },
        }),
      }),
    })),
    insert: jest.fn((table: unknown) => ({
      values: async (values: unknown) => {
        inserts.push({ table, values });
      },
    })),
  };
  mockDb.transaction.mockImplementationOnce(async (callback: (transaction: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, updates, inserts };
}

function updateQuery(update: UpdateRecord | undefined) {
  if (!update) throw new Error('Expected update was not recorded.');
  return dialect.sqlToQuery((update.condition as SQLWrapper).getSQL());
}

describe('Club archival lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLockedClubAction.mockResolvedValue({
      membershipStatus: 'active',
      responsibilities: ['owner'],
      clubArchivedAt: null,
    });
  });

  it('archives and applies the complete automatic cascade in one locked transaction', async () => {
    const { updates, inserts } = lifecycleTransaction();

    await expect(archiveWorkspaceClub('owner-id', 'club-id')).resolves.toMatchObject({
      id: 'club-id',
      archivedAt: expect.any(String),
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockRequireLockedClubAction).toHaveBeenCalledWith(
      expect.anything(),
      'owner-id',
      'club-id',
      'club.archive',
    );
    expect(updates.map(({ table }) => table)).toEqual([
      membershipRequests,
      clubInvitations,
      clubPlaySessions,
      tournaments,
      clubs,
    ]);
    expect(updates.find(({ table }) => table === membershipRequests)?.values).toMatchObject({
      status: 'cancelled',
      resolvedAt: expect.any(Date),
      resolvedById: 'owner-id',
    });
    expect(updates.find(({ table }) => table === clubInvitations)?.values).toMatchObject({
      revokedAt: expect.any(Date),
    });
    expect(updates.find(({ table }) => table === clubPlaySessions)?.values).toMatchObject({
      cancelledAt: expect.any(Date),
      cancelledById: 'owner-id',
      version: expect.anything(),
    });
    expect(updates.find(({ table }) => table === tournaments)?.values).toMatchObject({
      status: 'cancelled',
    });
    expect(updates.find(({ table }) => table === clubs)?.values).toMatchObject({
      archivedAt: expect.any(Date),
    });
    expect(updates.some(({ table }) => table === clubMemberships)).toBe(false);
    expect(updates.some(({ table }) => table === clubResponsibilities)).toBe(false);

    const requestQuery = updateQuery(updates.find(({ table }) => table === membershipRequests));
    expect(requestQuery.sql).toContain('"membership_requests"."status" = $2');
    expect(requestQuery.params).toEqual(['club-id', 'pending']);
    const invitationQuery = updateQuery(updates.find(({ table }) => table === clubInvitations));
    expect(invitationQuery.sql).toContain('"club_invitations"."accepted_at" is null');
    expect(invitationQuery.sql).toContain('"club_invitations"."revoked_at" is null');
    expect(invitationQuery.sql).toContain('"club_invitations"."expires_at" >');
    const sessionQuery = updateQuery(updates.find(({ table }) => table === clubPlaySessions));
    expect(sessionQuery.sql).toContain('"club_play_sessions"."starts_at" > $2');
    expect(sessionQuery.sql).toContain('"club_play_sessions"."cancelled_at" is null');
    const tournamentQuery = updateQuery(updates.find(({ table }) => table === tournaments));
    expect(tournamentQuery.sql).toContain('"tournaments"."status" in ($2, $3)');
    expect(tournamentQuery.params).toEqual(['club-id', 'draft', 'registration']);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual({
      table: auditLogs,
      values: expect.objectContaining({
        actorId: 'owner-id',
        clubId: 'club-id',
        action: 'club.archive',
        entityType: 'club',
        entityId: 'club-id',
        metadata: {
          reason: 'club-archived',
          automaticCascade: {
            cancelledMembershipRequestIds: ['pending-request-id'],
            revokedClubInvitationIds: ['pending-invitation-id'],
            cancelledClubPlaySessionIds: ['future-session-id'],
            cancelledOfficialTournamentIds: ['draft-tournament-id', 'registration-tournament-id'],
          },
        },
      }),
    });
  });

  it.each(['group-stage', 'knockout'] as const)(
    'rejects archival during %s without any partial changes',
    async (status) => {
      const { updates, inserts } = lifecycleTransaction({
        blockingTournaments: [{ id: 'active-tournament-id', status }],
      });

      await expect(archiveWorkspaceClub('owner-id', 'club-id')).rejects.toMatchObject({
        code: 'CLUB_ARCHIVE_ACTIVE_TOURNAMENT',
        status: 409,
      });
      expect(updates).toHaveLength(0);
      expect(inserts).toHaveLength(0);
    },
  );

  it('does not mark or audit the Club when a cascade operation fails', async () => {
    const { updates, inserts } = lifecycleTransaction({ failTable: clubPlaySessions });

    await expect(archiveWorkspaceClub('owner-id', 'club-id')).rejects.toThrow('cascade failed');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(updates.some(({ table }) => table === clubs)).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it('restores only the Club and records an audit without reopening cascaded records', async () => {
    mockRequireLockedClubAction.mockResolvedValueOnce({
      membershipStatus: null,
      responsibilities: [],
      clubArchivedAt: new Date(),
      platformRole: 'platform-admin',
    });
    const { updates, inserts } = lifecycleTransaction();

    await expect(restoreWorkspaceClub('platform-admin-id', 'club-id')).resolves.toEqual({
      id: 'club-id',
      archivedAt: null,
    });

    expect(mockRequireLockedClubAction).toHaveBeenCalledWith(
      expect.anything(),
      'platform-admin-id',
      'club-id',
      'club.restore',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: clubs,
      values: { archivedAt: null, updatedAt: expect.any(Date) },
    });
    expect(inserts).toEqual([
      {
        table: auditLogs,
        values: expect.objectContaining({
          actorId: 'platform-admin-id',
          clubId: 'club-id',
          action: 'club.restore',
          entityType: 'club',
          entityId: 'club-id',
        }),
      },
    ]);
  });
});

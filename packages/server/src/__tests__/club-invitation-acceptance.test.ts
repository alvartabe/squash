import {
  auditLogs,
  clubInvitations,
  clubMemberships,
  clubResponsibilities,
} from '@squash/db/schema';
import { requireRegisteredPlayer } from '../authorization';
import { acceptPlayerClubInvitation } from '../club-admin';
import { db } from '../database';

jest.mock('../database', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireClubAccess: jest.fn(),
  requireClubAction: jest.fn(),
  requirePlatformAdmin: jest.fn(),
  requireRegisteredPlayer: jest.fn(),
}));

const mockDb = db as unknown as { transaction: jest.Mock };
const mockRequireRegisteredPlayer = requireRegisteredPlayer as jest.Mock;

type Responsibility = 'admin' | 'coach' | null;

type InvitationRecord = {
  id: string;
  clubId: string;
  email: string;
  responsibility: Responsibility;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  clubArchivedAt: Date | null;
};

function acceptanceHarness(input?: {
  invitation?: Partial<InvitationRecord>;
  invitationFound?: boolean;
  membershipStatus?: 'active' | 'suspended' | 'ended' | null;
  serializeTransactions?: boolean;
}) {
  const invitation: InvitationRecord = {
    id: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
    clubId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
    email: 'player@example.com',
    responsibility: null,
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    clubArchivedAt: null,
    ...input?.invitation,
  };
  const invitationLock = jest.fn(async () =>
    input?.invitationFound === false ? [] : [{ ...invitation }],
  );
  const membershipLock = jest.fn(async () =>
    input?.membershipStatus ? [{ status: input.membershipStatus }] : [],
  );
  const insertions: Array<{ table: unknown; values: unknown }> = [];
  const deletions: unknown[] = [];

  const tx = {
    select: jest.fn(() => ({
      from: (table: unknown) => {
        if (table === clubInvitations) {
          return {
            innerJoin: () => ({
              where: () => ({
                limit: () => ({ for: invitationLock }),
              }),
            }),
          };
        }
        if (table === clubMemberships) {
          return {
            where: () => ({
              limit: () => ({ for: membershipLock }),
            }),
          };
        }
        throw new Error('Unexpected acceptance select.');
      },
    })),
    update: jest.fn((table: unknown) => ({
      set: (values: { acceptedAt: Date }) => ({
        where: () => ({
          returning: async () => {
            if (table !== clubInvitations || invitation.acceptedAt) return [];
            invitation.acceptedAt = values.acceptedAt;
            return [{ id: invitation.id }];
          },
        }),
      }),
    })),
    insert: jest.fn((table: unknown) => ({
      values: (values: unknown) => {
        insertions.push({ table, values });
        if (table === clubMemberships) {
          return { onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) };
        }
        if (table === clubResponsibilities) {
          return { onConflictDoNothing: jest.fn().mockResolvedValue(undefined) };
        }
        return Promise.resolve();
      },
    })),
    delete: jest.fn((table: unknown) => ({
      where: async () => {
        deletions.push(table);
      },
    })),
  };

  if (input?.serializeTransactions) {
    let previous = Promise.resolve();
    mockDb.transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) => {
      const current = previous.then(() => callback(tx));
      previous = current.then(
        () => undefined,
        () => undefined,
      );
      return current;
    });
  } else {
    mockDb.transaction.mockImplementation((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    );
  }

  return { invitation, invitationLock, membershipLock, insertions, deletions };
}

function accept() {
  return acceptPlayerClubInvitation(
    'player-id',
    '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
    'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
  );
}

describe('Player Club Invitation acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRegisteredPlayer.mockResolvedValue({
      id: 'player-id',
      email: 'player@example.com',
    });
  });

  it('creates an Active Membership for a matching Player invitation', async () => {
    const harness = acceptanceHarness();

    await expect(accept()).resolves.toEqual({
      clubId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
      accepted: true,
    });

    expect(
      harness.insertions
        .filter(({ table }) => table === clubMemberships)
        .map(({ values }) => values),
    ).toEqual([
      {
        clubId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
        userId: 'player-id',
        status: 'active',
      },
    ]);
    expect(harness.insertions.filter(({ table }) => table === clubResponsibilities)).toHaveLength(
      0,
    );
    expect(harness.invitationLock).toHaveBeenCalledWith('update');
    expect(harness.membershipLock).toHaveBeenCalledWith('update');
    expect(
      harness.insertions.filter(({ table }) => table === auditLogs).map(({ values }) => values),
    ).toEqual([
      expect.objectContaining({
        action: 'club.invitation.accept',
        metadata: { responsibility: null },
      }),
    ]);
  });

  it.each(['coach', 'admin'] as const)(
    'applies the invitation %s responsibility',
    async (responsibility) => {
      const harness = acceptanceHarness({ invitation: { responsibility } });

      await accept();

      expect(
        harness.insertions
          .filter(({ table }) => table === clubResponsibilities)
          .map(({ values }) => values),
      ).toEqual([
        expect.objectContaining({
          clubId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
          userId: 'player-id',
          responsibility,
        }),
      ]);
    },
  );

  it('reactivates an Ended Membership after removing stale responsibilities', async () => {
    const harness = acceptanceHarness({
      invitation: { responsibility: 'coach' },
      membershipStatus: 'ended',
    });

    await accept();

    expect(harness.deletions).toEqual([clubResponsibilities]);
    expect(
      harness.insertions
        .filter(({ table }) => table === clubResponsibilities)
        .map(({ values }) => values),
    ).toEqual([expect.objectContaining({ responsibility: 'coach' })]);
  });

  it('rejects an email mismatch without distinguishing it from an unavailable invitation', async () => {
    mockRequireRegisteredPlayer.mockResolvedValueOnce({
      id: 'player-id',
      email: 'different@example.com',
    });
    const harness = acceptanceHarness();

    await expect(accept()).rejects.toMatchObject({
      code: 'INVITATION_UNAVAILABLE',
      messageKey: 'error.invalidRequest',
      status: 404,
    });
    expect(harness.insertions).toHaveLength(0);
  });

  it('rejects an invitation that does not belong to the requested Club', async () => {
    const harness = acceptanceHarness({ invitationFound: false });

    await expect(accept()).rejects.toMatchObject({
      code: 'INVITATION_UNAVAILABLE',
      status: 404,
    });
    expect(harness.insertions).toHaveLength(0);
  });

  it.each([
    [{ revokedAt: new Date() }, 'INVITATION_REVOKED', 409],
    [{ expiresAt: new Date(Date.now() - 1_000) }, 'INVITATION_EXPIRED', 410],
  ] as const)('rejects an unavailable invitation', async (invitation, code, status) => {
    const harness = acceptanceHarness({ invitation });

    await expect(accept()).rejects.toMatchObject({ code, status });
    expect(harness.insertions).toHaveLength(0);
  });

  it('rejects acceptance for an archived Club', async () => {
    const harness = acceptanceHarness({
      invitation: { clubArchivedAt: new Date() },
    });

    await expect(accept()).rejects.toMatchObject({
      code: 'CLUB_ARCHIVED',
      status: 409,
    });
    expect(harness.insertions).toHaveLength(0);
  });

  it('serializes repeated acceptance without duplicate Memberships, responsibilities, or audits', async () => {
    const harness = acceptanceHarness({
      invitation: { responsibility: 'coach' },
      serializeTransactions: true,
    });

    await expect(Promise.all([accept(), accept()])).resolves.toEqual([
      {
        clubId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
        accepted: true,
      },
      {
        clubId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
        accepted: true,
      },
    ]);

    expect(harness.insertions.filter(({ table }) => table === clubMemberships)).toHaveLength(1);
    expect(harness.insertions.filter(({ table }) => table === clubResponsibilities)).toHaveLength(
      1,
    );
    expect(harness.insertions.filter(({ table }) => table === auditLogs)).toHaveLength(1);
    expect(harness.invitationLock).toHaveBeenCalledTimes(2);
  });
});

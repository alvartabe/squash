import {
  auditLogs,
  clubMemberships,
  clubResponsibilities,
  membershipRequests,
} from '@squash/db/schema';
import { requireMembershipRequestReviewer } from '../authorization';
import { db } from '../database';
import {
  approveMembershipRequest,
  cancelMembershipRequest,
  rejectMembershipRequest,
  submitMembershipRequest,
} from '../membership-requests';

jest.mock('../database', () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireMembershipRequestReviewer: jest.fn(),
}));

const mockDb = db as unknown as { transaction: jest.Mock };
const mockRequireReviewer = requireMembershipRequestReviewer as jest.Mock;

const pendingRequest = {
  id: 'request-id',
  clubId: 'club-id',
  playerId: 'player-id',
  playerName: 'Player',
  playerImage: null,
  status: 'pending' as const,
  submittedAt: new Date('2026-07-04T12:00:00.000Z'),
  resolvedAt: null,
  resolvedById: null,
};

function lockedSelect(rows: unknown[]) {
  const query = {
    where: () => ({
      limit: () => ({
        for: async () => rows,
      }),
    }),
  };
  return {
    from: () => ({
      ...query,
      innerJoin: () => query,
    }),
  };
}

function plainSelect(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  };
}

function transactionWith(
  selects: unknown[],
  options: {
    insertedRequest?: typeof pendingRequest;
    resolvedStatus?: 'approved' | 'rejected' | 'cancelled';
  } = {},
) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: unknown }> = [];
  const deletes: unknown[] = [];
  const select = jest.fn();
  for (const result of selects) {
    select.mockReturnValueOnce(result);
  }
  const tx = {
    select,
    insert: jest.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        if (table === membershipRequests) {
          return {
            returning: async () => [options.insertedRequest ?? pendingRequest],
          };
        }
        return Promise.resolve();
      },
    })),
    update: jest.fn((table: unknown) => ({
      set: (values: unknown) => {
        updates.push({ table, values });
        return {
          where: () => {
            if (table === membershipRequests) {
              return {
                returning: async () => [
                  {
                    ...pendingRequest,
                    ...(values as object),
                    status: options.resolvedStatus,
                  },
                ],
              };
            }
            return Promise.resolve();
          },
        };
      },
    })),
    delete: jest.fn((table: unknown) => {
      deletes.push(table);
      return { where: jest.fn().mockResolvedValue(undefined) };
    }),
  };
  mockDb.transaction.mockImplementationOnce(async (callback: (transaction: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, inserts, updates, deletes };
}

describe('Membership Request submission and cancellation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not allow an Active or Suspended member to submit a request', async () => {
    const { tx } = transactionWith([
      lockedSelect([{ id: 'club-id', archivedAt: null }]),
      plainSelect([{ id: 'player-id', name: 'Player', image: null }]),
      lockedSelect([{ status: 'active' }]),
    ]);

    await expect(submitMembershipRequest('player-id', 'club-id')).rejects.toMatchObject({
      code: 'ALREADY_CLUB_MEMBER',
      status: 409,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('creates a new Pending request after an Ended Membership and audits it', async () => {
    const { inserts } = transactionWith([
      lockedSelect([{ id: 'club-id', archivedAt: null }]),
      plainSelect([{ id: 'player-id', name: 'Player', image: null }]),
      lockedSelect([{ status: 'ended' }]),
      lockedSelect([]),
    ]);

    await expect(submitMembershipRequest('player-id', 'club-id')).resolves.toMatchObject({
      id: 'request-id',
      status: 'pending',
    });
    expect(inserts.find((entry) => entry.table === membershipRequests)?.values).toEqual({
      clubId: 'club-id',
      playerId: 'player-id',
    });
    expect(inserts.find((entry) => entry.table === auditLogs)?.values).toMatchObject({
      actorId: 'player-id',
      action: 'club.membership-request.submit',
      entityId: 'request-id',
      metadata: { playerId: 'player-id', status: 'pending' },
    });
  });

  it('allows only the submitting Player to cancel a Pending request', async () => {
    const { tx } = transactionWith([lockedSelect([pendingRequest])]);

    await expect(
      cancelMembershipRequest('different-player-id', 'club-id', 'request-id'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('does not modify a terminal request', async () => {
    const { tx } = transactionWith([lockedSelect([{ ...pendingRequest, status: 'rejected' }])]);

    await expect(
      cancelMembershipRequest('player-id', 'club-id', 'request-id'),
    ).rejects.toMatchObject({
      code: 'MEMBERSHIP_REQUEST_NOT_PENDING',
      status: 409,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('cancels a Pending request and records the transition in the audit log', async () => {
    const { inserts } = transactionWith([lockedSelect([pendingRequest])], {
      resolvedStatus: 'cancelled',
    });

    await expect(
      cancelMembershipRequest('player-id', 'club-id', 'request-id'),
    ).resolves.toMatchObject({
      status: 'cancelled',
      resolvedById: 'player-id',
    });
    expect(inserts.find((entry) => entry.table === auditLogs)?.values).toMatchObject({
      action: 'club.membership-request.cancel',
      metadata: {
        playerId: 'player-id',
        fromStatus: 'pending',
        toStatus: 'cancelled',
      },
    });
  });
});

describe('Membership Request review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireReviewer.mockResolvedValue({
      membershipStatus: 'active',
      responsibilities: ['owner'],
    });
  });

  it('rejects a Pending request without creating a Membership', async () => {
    const { inserts } = transactionWith(
      [lockedSelect([{ id: 'club-id', archivedAt: null }]), lockedSelect([pendingRequest])],
      {
        resolvedStatus: 'rejected',
      },
    );

    await expect(
      rejectMembershipRequest('owner-id', 'club-id', 'request-id'),
    ).resolves.toMatchObject({ status: 'rejected', resolvedById: 'owner-id' });
    expect(mockRequireReviewer).toHaveBeenCalledWith('owner-id', 'club-id');
    expect(inserts.some((entry) => entry.table === clubMemberships)).toBe(false);
    expect(inserts.find((entry) => entry.table === auditLogs)?.values).toMatchObject({
      action: 'club.membership-request.reject',
      metadata: {
        playerId: 'player-id',
        fromStatus: 'pending',
        toStatus: 'rejected',
      },
    });
  });

  it('approves a request by creating an Active Membership with no responsibilities', async () => {
    const { inserts } = transactionWith(
      [
        lockedSelect([{ id: 'club-id', archivedAt: null }]),
        lockedSelect([pendingRequest]),
        lockedSelect([]),
      ],
      { resolvedStatus: 'approved' },
    );

    await expect(
      approveMembershipRequest('owner-id', 'club-id', 'request-id'),
    ).resolves.toMatchObject({ status: 'approved' });
    expect(inserts.find((entry) => entry.table === clubMemberships)?.values).toMatchObject({
      clubId: 'club-id',
      userId: 'player-id',
    });
    expect(inserts.some((entry) => entry.table === clubResponsibilities)).toBe(false);
    expect(inserts.find((entry) => entry.table === auditLogs)?.values).toMatchObject({
      action: 'club.membership-request.approve',
      metadata: {
        playerId: 'player-id',
        membershipStatus: 'active',
        responsibilities: [],
      },
    });
  });

  it('reactivates an Ended Membership and removes its old responsibilities', async () => {
    const { inserts, updates, deletes } = transactionWith(
      [
        lockedSelect([{ id: 'club-id', archivedAt: null }]),
        lockedSelect([pendingRequest]),
        lockedSelect([{ status: 'ended' }]),
      ],
      { resolvedStatus: 'approved' },
    );

    await approveMembershipRequest('admin-id', 'club-id', 'request-id');

    expect(updates.find((entry) => entry.table === clubMemberships)?.values).toMatchObject({
      status: 'active',
    });
    expect(deletes).toContain(clubResponsibilities);
    expect(inserts.some((entry) => entry.table === clubResponsibilities)).toBe(false);
  });
});

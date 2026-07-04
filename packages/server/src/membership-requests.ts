import type { MembershipRequest, MembershipRequestStatus, PaginatedData } from '@squash/contracts';
import {
  auditLogs,
  clubMemberships,
  clubResponsibilities,
  clubs,
  membershipRequests,
  users,
} from '@squash/db/schema';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { requireMembershipRequestReviewer } from './authorization';
import { db } from './database';
import { forbidden, notFound, ServiceError } from './errors';

type MembershipRequestListQuery = {
  page: number;
  pageSize: number;
  search: string;
  status?: MembershipRequestStatus | undefined;
};

function pageResult<T>(
  items: T[],
  total: number,
  query: { page: number; pageSize: number },
): PaginatedData<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

function serializeRequest(record: {
  id: string;
  clubId: string;
  playerId: string;
  playerName: string;
  playerImage: string | null;
  status: MembershipRequestStatus;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolvedById: string | null;
}): MembershipRequest {
  return {
    ...record,
    submittedAt: record.submittedAt.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
  };
}

function requestAudit(input: {
  actorId: string;
  clubId: string;
  requestId: string;
  action: 'submit' | 'cancel' | 'approve' | 'reject';
  playerId: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    actorId: input.actorId,
    clubId: input.clubId,
    action: `club.membership-request.${input.action}`,
    entityType: 'membership-request',
    entityId: input.requestId,
    metadata: {
      playerId: input.playerId,
      ...input.metadata,
    },
  };
}

export async function listMembershipRequests(
  actorId: string,
  clubId: string,
  query: MembershipRequestListQuery,
): Promise<PaginatedData<MembershipRequest>> {
  await requireMembershipRequestReviewer(actorId, clubId);
  const condition = and(
    eq(membershipRequests.clubId, clubId),
    query.status ? eq(membershipRequests.status, query.status) : undefined,
    query.search ? ilike(users.name, `%${query.search}%`) : undefined,
  );
  const rows = await db
    .select({
      id: membershipRequests.id,
      clubId: membershipRequests.clubId,
      playerId: membershipRequests.playerId,
      playerName: users.name,
      playerImage: users.image,
      status: membershipRequests.status,
      submittedAt: membershipRequests.submittedAt,
      resolvedAt: membershipRequests.resolvedAt,
      resolvedById: membershipRequests.resolvedById,
    })
    .from(membershipRequests)
    .innerJoin(users, eq(users.id, membershipRequests.playerId))
    .where(condition)
    .orderBy(desc(membershipRequests.submittedAt), asc(membershipRequests.id))
    .limit(query.pageSize)
    .offset(query.page * query.pageSize);
  const [totalRow] = await db
    .select({ value: count() })
    .from(membershipRequests)
    .innerJoin(users, eq(users.id, membershipRequests.playerId))
    .where(condition);
  return pageResult(
    rows.map((record) => serializeRequest(record)),
    totalRow?.value ?? 0,
    query,
  );
}

export async function submitMembershipRequest(
  actorId: string,
  clubId: string,
): Promise<MembershipRequest> {
  return db.transaction(async (tx) => {
    const [club] = await tx
      .select({ id: clubs.id, archivedAt: clubs.archivedAt })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1)
      .for('update');
    if (!club) throw notFound('CLUB_NOT_FOUND');
    if (club.archivedAt) {
      throw new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409);
    }

    const [player] = await tx
      .select({ id: users.id, name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (!player) throw notFound('PLAYER_NOT_FOUND');

    const [membership] = await tx
      .select({ status: clubMemberships.status })
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, actorId)))
      .limit(1)
      .for('update');
    if (membership && membership.status !== 'ended') {
      throw new ServiceError('ALREADY_CLUB_MEMBER', 'error.invalidRequest', 409);
    }

    const [pending] = await tx
      .select({ id: membershipRequests.id })
      .from(membershipRequests)
      .where(
        and(
          eq(membershipRequests.clubId, clubId),
          eq(membershipRequests.playerId, actorId),
          eq(membershipRequests.status, 'pending'),
        ),
      )
      .limit(1)
      .for('update');
    if (pending) {
      throw new ServiceError('MEMBERSHIP_REQUEST_PENDING', 'error.invalidRequest', 409);
    }

    const [created] = await tx
      .insert(membershipRequests)
      .values({ clubId, playerId: actorId })
      .returning();
    if (!created) throw new Error('Failed to create Membership Request.');
    await tx.insert(auditLogs).values(
      requestAudit({
        actorId,
        clubId,
        requestId: created.id,
        action: 'submit',
        playerId: actorId,
        metadata: { status: 'pending' },
      }),
    );
    return serializeRequest({
      ...created,
      playerName: player.name,
      playerImage: player.image,
    });
  });
}

export async function cancelMembershipRequest(
  actorId: string,
  clubId: string,
  requestId: string,
): Promise<MembershipRequest> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        id: membershipRequests.id,
        clubId: membershipRequests.clubId,
        playerId: membershipRequests.playerId,
        playerName: users.name,
        playerImage: users.image,
        status: membershipRequests.status,
        submittedAt: membershipRequests.submittedAt,
        resolvedAt: membershipRequests.resolvedAt,
        resolvedById: membershipRequests.resolvedById,
      })
      .from(membershipRequests)
      .innerJoin(users, eq(users.id, membershipRequests.playerId))
      .where(and(eq(membershipRequests.id, requestId), eq(membershipRequests.clubId, clubId)))
      .limit(1)
      .for('update');
    if (!request) throw notFound('MEMBERSHIP_REQUEST_NOT_FOUND');
    if (request.playerId !== actorId) throw forbidden();
    if (request.status !== 'pending') {
      throw new ServiceError('MEMBERSHIP_REQUEST_NOT_PENDING', 'error.invalidRequest', 409);
    }

    const resolvedAt = new Date();
    const [cancelled] = await tx
      .update(membershipRequests)
      .set({ status: 'cancelled', resolvedAt, resolvedById: actorId })
      .where(and(eq(membershipRequests.id, requestId), eq(membershipRequests.status, 'pending')))
      .returning();
    if (!cancelled) {
      throw new ServiceError('MEMBERSHIP_REQUEST_NOT_PENDING', 'error.invalidRequest', 409);
    }
    await tx.insert(auditLogs).values(
      requestAudit({
        actorId,
        clubId,
        requestId,
        action: 'cancel',
        playerId: actorId,
        metadata: { fromStatus: 'pending', toStatus: 'cancelled' },
      }),
    );
    return serializeRequest({
      ...cancelled,
      playerName: request.playerName,
      playerImage: request.playerImage,
    });
  });
}

async function decideMembershipRequest(
  actorId: string,
  clubId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
): Promise<MembershipRequest> {
  await requireMembershipRequestReviewer(actorId, clubId);
  return db.transaction(async (tx) => {
    const [club] = await tx
      .select({ id: clubs.id, archivedAt: clubs.archivedAt })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1)
      .for('update');
    if (!club) throw notFound('CLUB_NOT_FOUND');
    if (club.archivedAt) {
      throw new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409);
    }

    const [request] = await tx
      .select({
        id: membershipRequests.id,
        clubId: membershipRequests.clubId,
        playerId: membershipRequests.playerId,
        playerName: users.name,
        playerImage: users.image,
        status: membershipRequests.status,
        submittedAt: membershipRequests.submittedAt,
        resolvedAt: membershipRequests.resolvedAt,
        resolvedById: membershipRequests.resolvedById,
      })
      .from(membershipRequests)
      .innerJoin(users, eq(users.id, membershipRequests.playerId))
      .where(and(eq(membershipRequests.id, requestId), eq(membershipRequests.clubId, clubId)))
      .limit(1)
      .for('update');
    if (!request) throw notFound('MEMBERSHIP_REQUEST_NOT_FOUND');
    if (request.status !== 'pending') {
      throw new ServiceError('MEMBERSHIP_REQUEST_NOT_PENDING', 'error.invalidRequest', 409);
    }

    if (decision === 'approved') {
      const [membership] = await tx
        .select({ status: clubMemberships.status })
        .from(clubMemberships)
        .where(
          and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, request.playerId)),
        )
        .limit(1)
        .for('update');
      if (membership && membership.status !== 'ended') {
        throw new ServiceError('ALREADY_CLUB_MEMBER', 'error.invalidRequest', 409);
      }

      const joinedAt = new Date();
      if (membership) {
        await tx
          .update(clubMemberships)
          .set({ status: 'active', joinedAt, updatedAt: joinedAt })
          .where(
            and(
              eq(clubMemberships.clubId, clubId),
              eq(clubMemberships.userId, request.playerId),
              eq(clubMemberships.status, 'ended'),
            ),
          );
        await tx
          .delete(clubResponsibilities)
          .where(
            and(
              eq(clubResponsibilities.clubId, clubId),
              eq(clubResponsibilities.userId, request.playerId),
            ),
          );
      } else {
        await tx.insert(clubMemberships).values({ clubId, userId: request.playerId, joinedAt });
      }
    }

    const resolvedAt = new Date();
    const [resolved] = await tx
      .update(membershipRequests)
      .set({ status: decision, resolvedAt, resolvedById: actorId })
      .where(and(eq(membershipRequests.id, requestId), eq(membershipRequests.status, 'pending')))
      .returning();
    if (!resolved) {
      throw new ServiceError('MEMBERSHIP_REQUEST_NOT_PENDING', 'error.invalidRequest', 409);
    }
    await tx.insert(auditLogs).values(
      requestAudit({
        actorId,
        clubId,
        requestId,
        action: decision === 'approved' ? 'approve' : 'reject',
        playerId: request.playerId,
        metadata: {
          fromStatus: 'pending',
          toStatus: decision,
          ...(decision === 'approved' ? { membershipStatus: 'active', responsibilities: [] } : {}),
        },
      }),
    );
    return serializeRequest({
      ...resolved,
      playerName: request.playerName,
      playerImage: request.playerImage,
    });
  });
}

export function approveMembershipRequest(actorId: string, clubId: string, requestId: string) {
  return decideMembershipRequest(actorId, clubId, requestId, 'approved');
}

export function rejectMembershipRequest(actorId: string, clubId: string, requestId: string) {
  return decideMembershipRequest(actorId, clubId, requestId, 'rejected');
}

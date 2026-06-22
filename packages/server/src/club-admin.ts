import { createHash, randomBytes } from 'node:crypto';
import type {
  ClubInvitation,
  ClubMember,
  ClubRole,
  ClubSummary,
  InviteClubRole,
  PaginatedData,
} from '@squash/contracts';
import {
  auditLogs,
  clubInvitations,
  clubMemberships,
  clubs,
  outboxEvents,
  users,
} from '@squash/db/schema';
import { canPerformClubAction, clubActions } from '@squash/domain';
import { translate, type Locale } from '@squash/i18n';
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import { requireClubAccess, requireClubAction, requirePlatformAdmin } from './authorization';
import { db } from './database';
import { forbidden, notFound, ServiceError } from './errors';
import { renderAuthEmail } from './emails';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type PageQuery = { page: number; pageSize: number; search: string };

function pageResult<T>(items: T[], total: number, query: PageQuery): PaginatedData<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createInvitationToken() {
  return randomBytes(32).toString('base64url');
}

function dateValue(value: Date | null) {
  return value?.toISOString() ?? null;
}

async function platformRole(userId: string) {
  const [record] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!record) throw notFound('USER_NOT_FOUND');
  return record.role;
}

function auditValue(input: {
  actorId: string;
  clubId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    actorId: input.actorId,
    clubId: input.clubId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  };
}

export async function getCurrentWorkspaceUser(actorId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      locale: users.locale,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!user) throw notFound('USER_NOT_FOUND');

  const memberships = await db
    .select({
      clubId: clubs.id,
      clubName: clubs.name,
      clubSlug: clubs.slug,
      clubTimeZone: clubs.timeZone,
      role: clubMemberships.role,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(and(eq(clubMemberships.userId, actorId), isNull(clubs.archivedAt)))
    .orderBy(asc(clubs.name));

  return {
    user,
    platformAdmin: user.role === 'platform-admin',
    workspaceAccess:
      user.role === 'platform-admin' ||
      memberships.some((membership) => membership.role !== 'player') ||
      memberships.length === 0,
    memberships: memberships.map((membership) => ({
      ...membership,
      permissions: clubActions.filter((action) =>
        canPerformClubAction(user.role, membership.role, action),
      ),
    })),
  };
}

export async function listWorkspaceClubs(
  actorId: string,
  query: PageQuery & { includeArchived: boolean },
): Promise<PaginatedData<ClubSummary>> {
  const role = await platformRole(actorId);
  const searchFilter = query.search ? ilike(clubs.name, `%${query.search}%`) : undefined;
  const archivedFilter = query.includeArchived ? undefined : isNull(clubs.archivedAt);
  const memberCount = sql<number>`(
    select count(*)::int from club_memberships cm where cm.club_id = ${clubs.id}
  )`.mapWith(Number);

  if (role === 'platform-admin') {
    const condition = and(searchFilter, archivedFilter);
    const rows = await db
      .select({
        id: clubs.id,
        name: clubs.name,
        slug: clubs.slug,
        timeZone: clubs.timeZone,
        archivedAt: clubs.archivedAt,
        memberCount,
      })
      .from(clubs)
      .where(condition)
      .orderBy(asc(clubs.name))
      .limit(query.pageSize)
      .offset(query.page * query.pageSize);
    const [totalRow] = await db.select({ value: count() }).from(clubs).where(condition);
    return pageResult(
      rows.map((item) => ({ ...item, role: null, archivedAt: dateValue(item.archivedAt) })),
      totalRow?.value ?? 0,
      query,
    );
  }

  const condition = and(eq(clubMemberships.userId, actorId), searchFilter, archivedFilter);
  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      timeZone: clubs.timeZone,
      archivedAt: clubs.archivedAt,
      role: clubMemberships.role,
      memberCount,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(condition)
    .orderBy(asc(clubs.name))
    .limit(query.pageSize)
    .offset(query.page * query.pageSize);
  const [totalRow] = await db
    .select({ value: count() })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(condition);
  return pageResult(
    rows.map((item) => ({ ...item, archivedAt: dateValue(item.archivedAt) })),
    totalRow?.value ?? 0,
    query,
  );
}

export async function getWorkspaceClub(actorId: string, clubId: string) {
  const authorization = await requireClubAccess(actorId, clubId);
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) throw notFound('CLUB_NOT_FOUND');
  const [members] = await db
    .select({ value: count() })
    .from(clubMemberships)
    .where(eq(clubMemberships.clubId, clubId));
  return {
    ...club,
    role: authorization.clubRole,
    memberCount: members?.value ?? 0,
    archivedAt: dateValue(club.archivedAt),
    createdAt: club.createdAt.toISOString(),
    updatedAt: club.updatedAt.toISOString(),
  };
}

export async function updateWorkspaceClub(
  actorId: string,
  clubId: string,
  input: { name: string; timeZone: string },
) {
  await requireClubAction(actorId, clubId, 'club.manage');
  const [club] = await db
    .update(clubs)
    .set({ name: input.name, timeZone: input.timeZone, updatedAt: new Date() })
    .where(and(eq(clubs.id, clubId), isNull(clubs.archivedAt)))
    .returning();
  if (!club) throw notFound('CLUB_NOT_FOUND');
  await db.insert(auditLogs).values(
    auditValue({
      actorId,
      clubId,
      action: 'club.update',
      entityType: 'club',
      entityId: clubId,
      metadata: input,
    }),
  );
  return club;
}

export async function archiveWorkspaceClub(actorId: string, clubId: string) {
  await requireClubAction(actorId, clubId, 'club.manage');
  const archivedAt = new Date();
  const [club] = await db
    .update(clubs)
    .set({ archivedAt, updatedAt: archivedAt })
    .where(and(eq(clubs.id, clubId), isNull(clubs.archivedAt)))
    .returning();
  if (!club) throw notFound('CLUB_NOT_FOUND');
  await db.insert(auditLogs).values(
    auditValue({
      actorId,
      clubId,
      action: 'club.archive',
      entityType: 'club',
      entityId: clubId,
    }),
  );
  return { id: club.id, archivedAt: archivedAt.toISOString() };
}

export async function listClubMembers(
  actorId: string,
  clubId: string,
  query: PageQuery,
): Promise<PaginatedData<ClubMember>> {
  await requireClubAction(actorId, clubId, 'members.manage');
  const searchFilter = query.search
    ? or(ilike(users.name, `%${query.search}%`), ilike(users.email, `%${query.search}%`))
    : undefined;
  const condition = and(eq(clubMemberships.clubId, clubId), searchFilter);
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: clubMemberships.role,
      joinedAt: clubMemberships.joinedAt,
    })
    .from(clubMemberships)
    .innerJoin(users, eq(users.id, clubMemberships.userId))
    .where(condition)
    .orderBy(asc(users.name))
    .limit(query.pageSize)
    .offset(query.page * query.pageSize);
  const [totalRow] = await db
    .select({ value: count() })
    .from(clubMemberships)
    .innerJoin(users, eq(users.id, clubMemberships.userId))
    .where(condition);
  return pageResult(
    rows.map((item) => ({ ...item, joinedAt: item.joinedAt.toISOString() })),
    totalRow?.value ?? 0,
    query,
  );
}

export async function listClubInvitations(
  actorId: string,
  clubId: string,
  query: PageQuery,
): Promise<PaginatedData<ClubInvitation>> {
  await requireClubAction(actorId, clubId, 'members.manage');
  const searchFilter = query.search ? ilike(clubInvitations.email, `%${query.search}%`) : undefined;
  const condition = and(eq(clubInvitations.clubId, clubId), searchFilter);
  const rows = await db
    .select()
    .from(clubInvitations)
    .where(condition)
    .orderBy(desc(clubInvitations.createdAt))
    .limit(query.pageSize)
    .offset(query.page * query.pageSize);
  const [totalRow] = await db.select({ value: count() }).from(clubInvitations).where(condition);
  return pageResult(
    rows.map((item) => ({
      id: item.id,
      clubId: item.clubId,
      email: item.email,
      role: item.role as InviteClubRole,
      expiresAt: item.expiresAt.toISOString(),
      acceptedAt: dateValue(item.acceptedAt),
      revokedAt: dateValue(item.revokedAt),
      createdAt: item.createdAt.toISOString(),
    })),
    totalRow?.value ?? 0,
    query,
  );
}

async function invitationEmail(locale: Locale, inviteUrl: string) {
  return renderAuthEmail({
    locale,
    headingKey: 'email.clubInvite.heading',
    bodyKey: 'email.clubInvite.body',
    actionKey: 'email.clubInvite.action',
    url: inviteUrl,
  });
}

export async function inviteClubMember(
  actorId: string,
  clubId: string,
  input: { email: string; role: InviteClubRole; locale: Locale },
) {
  await requireClubAction(actorId, clubId, 'members.manage');
  const [club] = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(and(eq(clubs.id, clubId), isNull(clubs.archivedAt)))
    .limit(1);
  if (!club) throw notFound('CLUB_NOT_FOUND');
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email))
    .limit(1);
  if (existingUser) {
    const [membership] = await db
      .select({ userId: clubMemberships.userId })
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, existingUser.id)))
      .limit(1);
    if (membership) throw new ServiceError('ALREADY_CLUB_MEMBER', 'error.invalidRequest', 409);
  }

  const rawToken = createInvitationToken();
  const hashed = tokenHash(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
  const invitation = await db.transaction(async (tx) => {
    const [pending] = await tx
      .select({ id: clubInvitations.id })
      .from(clubInvitations)
      .where(
        and(
          eq(clubInvitations.clubId, clubId),
          eq(clubInvitations.email, input.email),
          isNull(clubInvitations.acceptedAt),
          isNull(clubInvitations.revokedAt),
        ),
      )
      .limit(1);
    const [record] = pending
      ? await tx
          .update(clubInvitations)
          .set({
            role: input.role,
            tokenHash: hashed,
            expiresAt,
            invitedById: actorId,
            updatedAt: new Date(),
          })
          .where(eq(clubInvitations.id, pending.id))
          .returning()
      : await tx
          .insert(clubInvitations)
          .values({
            clubId,
            email: input.email,
            role: input.role,
            tokenHash: hashed,
            invitedById: actorId,
            expiresAt,
          })
          .returning();
    if (!record) throw new Error('Failed to create invitation.');
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/club-invitations/${rawToken}`;
    await tx.insert(outboxEvents).values({
      topic: 'email.send',
      aggregateId: record.id,
      payload: {
        to: input.email,
        subject: translate(input.locale, 'email.clubInvite.subject'),
        html: await invitationEmail(input.locale, inviteUrl),
      },
    });
    await tx.insert(auditLogs).values(
      auditValue({
        actorId,
        clubId,
        action: pending ? 'club.invitation.resend' : 'club.invitation.create',
        entityType: 'club-invitation',
        entityId: record.id,
        metadata: { email: input.email, role: input.role },
      }),
    );
    return record;
  });
  return { id: invitation.id, expiresAt: invitation.expiresAt.toISOString() };
}

export async function resendClubInvitation(
  actorId: string,
  clubId: string,
  invitationId: string,
  locale: Locale,
) {
  await requireClubAction(actorId, clubId, 'members.manage');
  const [invitation] = await db
    .select({ email: clubInvitations.email, role: clubInvitations.role })
    .from(clubInvitations)
    .where(
      and(
        eq(clubInvitations.id, invitationId),
        eq(clubInvitations.clubId, clubId),
        isNull(clubInvitations.acceptedAt),
        isNull(clubInvitations.revokedAt),
      ),
    )
    .limit(1);
  if (!invitation) throw notFound('INVITATION_NOT_FOUND');
  if (invitation.role === 'owner') throw forbidden();
  return inviteClubMember(actorId, clubId, {
    email: invitation.email,
    role: invitation.role,
    locale,
  });
}

export async function revokeClubInvitation(actorId: string, clubId: string, invitationId: string) {
  await requireClubAction(actorId, clubId, 'members.manage');
  const [record] = await db
    .update(clubInvitations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clubInvitations.id, invitationId),
        eq(clubInvitations.clubId, clubId),
        isNull(clubInvitations.acceptedAt),
        isNull(clubInvitations.revokedAt),
      ),
    )
    .returning();
  if (!record) throw notFound('INVITATION_NOT_FOUND');
  await db.insert(auditLogs).values(
    auditValue({
      actorId,
      clubId,
      action: 'club.invitation.revoke',
      entityType: 'club-invitation',
      entityId: invitationId,
    }),
  );
  return { id: record.id, revokedAt: record.revokedAt?.toISOString() };
}

export async function getClubInvitation(token: string) {
  const [record] = await db
    .select({
      id: clubInvitations.id,
      clubId: clubInvitations.clubId,
      clubName: clubs.name,
      email: clubInvitations.email,
      role: clubInvitations.role,
      expiresAt: clubInvitations.expiresAt,
      acceptedAt: clubInvitations.acceptedAt,
      revokedAt: clubInvitations.revokedAt,
    })
    .from(clubInvitations)
    .innerJoin(clubs, eq(clubs.id, clubInvitations.clubId))
    .where(eq(clubInvitations.tokenHash, tokenHash(token)))
    .limit(1);
  if (!record) throw notFound('INVITATION_NOT_FOUND');
  const status = record.acceptedAt
    ? 'accepted'
    : record.revokedAt
      ? 'revoked'
      : record.expiresAt <= new Date()
        ? 'expired'
        : 'pending';
  return {
    ...record,
    status,
    email: record.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    expiresAt: record.expiresAt.toISOString(),
    acceptedAt: dateValue(record.acceptedAt),
    revokedAt: dateValue(record.revokedAt),
  };
}

export async function acceptClubInvitation(actorId: string, token: string) {
  const hashed = tokenHash(token);
  return db.transaction(async (tx) => {
    const [record] = await tx
      .select({
        id: clubInvitations.id,
        clubId: clubInvitations.clubId,
        email: clubInvitations.email,
        role: clubInvitations.role,
        expiresAt: clubInvitations.expiresAt,
        acceptedAt: clubInvitations.acceptedAt,
        revokedAt: clubInvitations.revokedAt,
        userEmail: users.email,
      })
      .from(clubInvitations)
      .innerJoin(users, eq(users.id, actorId))
      .where(eq(clubInvitations.tokenHash, hashed))
      .limit(1);
    if (!record) throw notFound('INVITATION_NOT_FOUND');
    if (record.userEmail.toLowerCase() !== record.email) {
      throw new ServiceError('INVITATION_EMAIL_MISMATCH', 'error.forbidden', 403);
    }
    if (record.revokedAt) throw new ServiceError('INVITATION_REVOKED', 'error.invalidRequest', 409);
    if (record.expiresAt <= new Date())
      throw new ServiceError('INVITATION_EXPIRED', 'error.invalidRequest', 410);
    if (record.acceptedAt) {
      return { clubId: record.clubId, accepted: true };
    }
    await tx
      .insert(clubMemberships)
      .values({ clubId: record.clubId, userId: actorId, role: record.role })
      .onConflictDoNothing();
    const acceptedAt = new Date();
    await tx
      .update(clubInvitations)
      .set({ acceptedAt, updatedAt: acceptedAt })
      .where(and(eq(clubInvitations.id, record.id), isNull(clubInvitations.acceptedAt)));
    await tx.insert(auditLogs).values(
      auditValue({
        actorId,
        clubId: record.clubId,
        action: 'club.invitation.accept',
        entityType: 'club-invitation',
        entityId: record.id,
        metadata: { role: record.role },
      }),
    );
    return { clubId: record.clubId, accepted: true };
  });
}

export async function updateClubMemberRole(
  actorId: string,
  clubId: string,
  userId: string,
  role: InviteClubRole,
) {
  await requireClubAction(actorId, clubId, 'members.manage');
  if (actorId === userId)
    throw new ServiceError('CANNOT_CHANGE_OWN_ROLE', 'error.invalidRequest', 409);
  const [current] = await db
    .select({ role: clubMemberships.role })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
    .limit(1);
  if (!current) throw notFound('MEMBERSHIP_NOT_FOUND');
  if (current.role === 'owner')
    throw new ServiceError('OWNER_TRANSFER_REQUIRED', 'error.invalidRequest', 409);
  const [membership] = await db
    .update(clubMemberships)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
    .returning();
  await db.insert(auditLogs).values(
    auditValue({
      actorId,
      clubId,
      action: 'club.member.role-update',
      entityType: 'club-membership',
      entityId: userId,
      metadata: { from: current.role, to: role },
    }),
  );
  return membership;
}

export async function removeClubMember(actorId: string, clubId: string, userId: string) {
  await requireClubAction(actorId, clubId, 'members.manage');
  if (actorId === userId) throw new ServiceError('CANNOT_REMOVE_SELF', 'error.invalidRequest', 409);
  const [member] = await db
    .select({ role: clubMemberships.role })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
    .limit(1);
  if (!member) throw notFound('MEMBERSHIP_NOT_FOUND');
  if (member.role === 'owner') {
    const [owners] = await db
      .select({ value: count() })
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.role, 'owner')));
    if ((owners?.value ?? 0) <= 1)
      throw new ServiceError('LAST_OWNER', 'error.invalidRequest', 409);
  }
  await db
    .delete(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)));
  await db.insert(auditLogs).values(
    auditValue({
      actorId,
      clubId,
      action: 'club.member.remove',
      entityType: 'club-membership',
      entityId: userId,
      metadata: { role: member.role },
    }),
  );
  return { userId, removed: true };
}

export async function transferClubOwnership(actorId: string, clubId: string, newOwnerId: string) {
  const authorization = await requireClubAccess(actorId, clubId);
  if (authorization.platformRole !== 'platform-admin' && authorization.clubRole !== 'owner') {
    throw forbidden();
  }
  if (actorId === newOwnerId) throw new ServiceError('ALREADY_OWNER', 'error.invalidRequest', 409);
  const [target] = await db
    .select({ role: clubMemberships.role })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, newOwnerId)))
    .limit(1);
  if (!target) throw notFound('MEMBERSHIP_NOT_FOUND');
  await db.transaction(async (tx) => {
    await tx
      .update(clubMemberships)
      .set({ role: 'owner', updatedAt: new Date() })
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, newOwnerId)));
    if (authorization.clubRole === 'owner') {
      await tx
        .update(clubMemberships)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, actorId)));
    }
    await tx.insert(auditLogs).values(
      auditValue({
        actorId,
        clubId,
        action: 'club.owner.transfer',
        entityType: 'club-membership',
        entityId: newOwnerId,
        metadata: { previousRole: target.role },
      }),
    );
  });
  return { clubId, ownerId: newOwnerId };
}

export async function promotePlatformAdmin(actorId: string, userId: string) {
  await requirePlatformAdmin(actorId);
  const [user] = await db
    .update(users)
    .set({ role: 'platform-admin', updatedAt: new Date() })
    .where(and(eq(users.id, userId), ne(users.role, 'platform-admin')))
    .returning({ id: users.id });
  return user ?? { id: userId };
}

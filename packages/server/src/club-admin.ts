import { createHash, randomBytes } from 'node:crypto';
import type {
  ClubInvitation,
  ClubMember,
  ClubResponsibility,
  ClubSummary,
  InviteClubResponsibility,
  MembershipStatus,
  PaginatedData,
  UpdateClubInput,
} from '@squash/contracts';
import {
  auditLogs,
  clubInvitations,
  clubMemberships,
  clubResponsibilities,
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
import { membershipResponsibilities } from './membership';
import { clubProfileValues, requireValidClubLogoSelection } from './club-profile';
import { createMediaDownloadUrl, getMediaObjectKey } from './media';

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

function invitationResponsibility(
  responsibility: ClubResponsibility | null,
): InviteClubResponsibility {
  if (responsibility === 'owner') {
    throw new ServiceError('INVALID_INVITATION_RESPONSIBILITY', 'error.invalidRequest', 409);
  }
  return responsibility;
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
      membershipStatus: clubMemberships.status,
      responsibilities: membershipResponsibilities,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(
      and(
        eq(clubMemberships.userId, actorId),
        eq(clubMemberships.status, 'active'),
        isNull(clubs.archivedAt),
      ),
    )
    .orderBy(asc(clubs.name));

  return {
    user,
    platformAdmin: user.role === 'platform-admin',
    workspaceAccess:
      user.role === 'platform-admin' ||
      memberships.some((membership) => membership.responsibilities.length > 0) ||
      memberships.length === 0,
    memberships: memberships.map((membership) => ({
      ...membership,
      permissions: clubActions.filter((action) =>
        canPerformClubAction(
          user.role,
          membership.membershipStatus,
          membership.responsibilities,
          action,
        ),
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
    select count(*)::int
    from club_memberships cm
    where cm.club_id = ${clubs.id} and cm.status <> 'ended'
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
      rows.map((item) => ({
        ...item,
        membershipStatus: null,
        responsibilities: [],
        archivedAt: dateValue(item.archivedAt),
      })),
      totalRow?.value ?? 0,
      query,
    );
  }

  const condition = and(
    eq(clubMemberships.userId, actorId),
    eq(clubMemberships.status, 'active'),
    searchFilter,
    archivedFilter,
  );
  const rows = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      timeZone: clubs.timeZone,
      archivedAt: clubs.archivedAt,
      membershipStatus: clubMemberships.status,
      responsibilities: membershipResponsibilities,
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
    rows.map((item) => ({
      ...item,
      archivedAt: dateValue(item.archivedAt),
    })),
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
    .where(and(eq(clubMemberships.clubId, clubId), ne(clubMemberships.status, 'ended')));
  return {
    ...club,
    logoUrl: club.logoAssetId
      ? await createMediaDownloadUrl(await getMediaObjectKey(club.logoAssetId))
      : null,
    membershipStatus: authorization.membershipStatus,
    responsibilities: authorization.responsibilities,
    memberCount: members?.value ?? 0,
    archivedAt: dateValue(club.archivedAt),
    createdAt: club.createdAt.toISOString(),
    updatedAt: club.updatedAt.toISOString(),
  };
}

export async function updateWorkspaceClub(actorId: string, clubId: string, input: UpdateClubInput) {
  await requireClubAction(actorId, clubId, 'club.update');
  const [existing] = await db
    .select({ logoAssetId: clubs.logoAssetId })
    .from(clubs)
    .where(and(eq(clubs.id, clubId), isNull(clubs.archivedAt)))
    .limit(1);
  if (!existing) throw notFound('CLUB_NOT_FOUND');
  await requireValidClubLogoSelection(actorId, existing.logoAssetId, input.logoAssetId);
  const profile = clubProfileValues(input);
  const [club] = await db
    .update(clubs)
    .set({ ...profile, updatedAt: new Date() })
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
      metadata: profile,
    }),
  );
  return club;
}

export async function archiveWorkspaceClub(actorId: string, clubId: string) {
  await requireClubAction(actorId, clubId, 'club.archive');
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
      membershipStatus: clubMemberships.status,
      responsibilities: membershipResponsibilities,
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
    rows.map((item) => ({
      ...item,
      joinedAt: item.joinedAt.toISOString(),
    })),
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
      responsibility: invitationResponsibility(item.responsibility),
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
  input: { email: string; responsibility: InviteClubResponsibility; locale: Locale },
) {
  const authorization = await requireClubAction(actorId, clubId, 'members.manage');
  if (
    input.responsibility === 'admin' &&
    authorization.platformRole !== 'platform-admin' &&
    !authorization.responsibilities.includes('owner')
  ) {
    throw forbidden();
  }
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
      .select({ status: clubMemberships.status })
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, existingUser.id)))
      .limit(1);
    if (membership && membership.status !== 'ended') {
      throw new ServiceError('ALREADY_CLUB_MEMBER', 'error.invalidRequest', 409);
    }
  }

  const rawToken = createInvitationToken();
  const hashed = tokenHash(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
  const invitation = await db.transaction(async (tx) => {
    const [pending] = await tx
      .select({
        id: clubInvitations.id,
        responsibility: clubInvitations.responsibility,
      })
      .from(clubInvitations)
      .where(
        and(
          eq(clubInvitations.clubId, clubId),
          eq(clubInvitations.email, input.email),
          isNull(clubInvitations.acceptedAt),
          isNull(clubInvitations.revokedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (
      pending?.responsibility === 'admin' &&
      authorization.platformRole !== 'platform-admin' &&
      !authorization.responsibilities.includes('owner')
    ) {
      throw forbidden();
    }
    const [record] = pending
      ? await tx
          .update(clubInvitations)
          .set({
            responsibility: input.responsibility,
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
            responsibility: input.responsibility,
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
        metadata: { email: input.email, responsibility: input.responsibility },
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
    .select({
      email: clubInvitations.email,
      responsibility: clubInvitations.responsibility,
    })
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
  const responsibility = invitationResponsibility(invitation.responsibility);
  return inviteClubMember(actorId, clubId, {
    email: invitation.email,
    responsibility,
    locale,
  });
}

export async function revokeClubInvitation(actorId: string, clubId: string, invitationId: string) {
  const authorization = await requireClubAction(actorId, clubId, 'members.manage');
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select({
        id: clubInvitations.id,
        responsibility: clubInvitations.responsibility,
      })
      .from(clubInvitations)
      .where(
        and(
          eq(clubInvitations.id, invitationId),
          eq(clubInvitations.clubId, clubId),
          isNull(clubInvitations.acceptedAt),
          isNull(clubInvitations.revokedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (!invitation) throw notFound('INVITATION_NOT_FOUND');
    if (
      invitation.responsibility === 'admin' &&
      authorization.platformRole !== 'platform-admin' &&
      !authorization.responsibilities.includes('owner')
    ) {
      throw forbidden();
    }

    const revokedAt = new Date();
    const [record] = await tx
      .update(clubInvitations)
      .set({ revokedAt, updatedAt: revokedAt })
      .where(
        and(
          eq(clubInvitations.id, invitationId),
          isNull(clubInvitations.acceptedAt),
          isNull(clubInvitations.revokedAt),
        ),
      )
      .returning();
    if (!record) throw notFound('INVITATION_NOT_FOUND');
    await tx.insert(auditLogs).values(
      auditValue({
        actorId,
        clubId,
        action: 'club.invitation.revoke',
        entityType: 'club-invitation',
        entityId: invitationId,
      }),
    );
    return { id: record.id, revokedAt: record.revokedAt?.toISOString() };
  });
}

export async function getClubInvitation(token: string) {
  const [record] = await db
    .select({
      id: clubInvitations.id,
      clubId: clubInvitations.clubId,
      clubName: clubs.name,
      email: clubInvitations.email,
      responsibility: clubInvitations.responsibility,
      expiresAt: clubInvitations.expiresAt,
      acceptedAt: clubInvitations.acceptedAt,
      revokedAt: clubInvitations.revokedAt,
    })
    .from(clubInvitations)
    .innerJoin(clubs, eq(clubs.id, clubInvitations.clubId))
    .where(eq(clubInvitations.tokenHash, tokenHash(token)))
    .limit(1);
  if (!record) throw notFound('INVITATION_NOT_FOUND');
  const responsibility = invitationResponsibility(record.responsibility);
  const status = record.acceptedAt
    ? 'accepted'
    : record.revokedAt
      ? 'revoked'
      : record.expiresAt <= new Date()
        ? 'expired'
        : 'pending';
  return {
    ...record,
    responsibility,
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
        responsibility: clubInvitations.responsibility,
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
    const responsibility = invitationResponsibility(record.responsibility);
    if (record.userEmail.toLowerCase() !== record.email) {
      throw new ServiceError('INVITATION_EMAIL_MISMATCH', 'error.forbidden', 403);
    }
    if (record.revokedAt) throw new ServiceError('INVITATION_REVOKED', 'error.invalidRequest', 409);
    if (record.expiresAt <= new Date())
      throw new ServiceError('INVITATION_EXPIRED', 'error.invalidRequest', 410);
    if (record.acceptedAt) {
      return { clubId: record.clubId, accepted: true };
    }
    const [existingMembership] = await tx
      .select({ status: clubMemberships.status })
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, record.clubId), eq(clubMemberships.userId, actorId)))
      .limit(1);
    if (existingMembership && existingMembership.status !== 'ended') {
      throw new ServiceError('ALREADY_CLUB_MEMBER', 'error.invalidRequest', 409);
    }
    await tx
      .insert(clubMemberships)
      .values({ clubId: record.clubId, userId: actorId })
      .onConflictDoUpdate({
        target: [clubMemberships.clubId, clubMemberships.userId],
        set: { status: 'active', joinedAt: new Date(), updatedAt: new Date() },
      });
    if (existingMembership?.status === 'ended') {
      await tx
        .delete(clubResponsibilities)
        .where(
          and(
            eq(clubResponsibilities.clubId, record.clubId),
            eq(clubResponsibilities.userId, actorId),
          ),
        );
    }
    if (responsibility) {
      await tx
        .insert(clubResponsibilities)
        .values({
          clubId: record.clubId,
          userId: actorId,
          responsibility,
        })
        .onConflictDoNothing();
    }
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
        metadata: { responsibility },
      }),
    );
    return { clubId: record.clubId, accepted: true };
  });
}

export async function updateClubMembership(
  actorId: string,
  clubId: string,
  userId: string,
  input: {
    status?: MembershipStatus;
    responsibilities?: readonly ClubResponsibility[];
  },
) {
  const selfEndingMembership =
    actorId === userId && input.status === 'ended' && input.responsibilities === undefined;
  if (actorId === userId && !selfEndingMembership) {
    throw new ServiceError('CANNOT_CHANGE_OWN_MEMBERSHIP', 'error.invalidRequest', 409);
  }
  const authorization = selfEndingMembership
    ? null
    : await requireClubAction(actorId, clubId, 'members.manage');
  const [current] = await db
    .select({
      status: clubMemberships.status,
      responsibilities: membershipResponsibilities,
    })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
    .limit(1);
  if (!current) throw notFound('MEMBERSHIP_NOT_FOUND');

  const nextStatus = input.status ?? current.status;
  const nextResponsibilities = input.responsibilities ?? current.responsibilities;
  const isCurrentOwner = current.responsibilities.includes('owner');
  const isNextOwner = nextResponsibilities.includes('owner');
  if (isCurrentOwner && (nextStatus !== 'active' || !isNextOwner)) {
    throw new ServiceError('OWNER_TRANSFER_REQUIRED', 'error.invalidRequest', 409);
  }
  if (!isCurrentOwner && isNextOwner) {
    throw new ServiceError('OWNER_TRANSFER_REQUIRED', 'error.invalidRequest', 409);
  }
  if (current.status === 'ended' && nextStatus !== 'ended') {
    throw new ServiceError('MEMBERSHIP_REJOIN_REQUIRED', 'error.invalidRequest', 409);
  }
  const actorIsOwner =
    authorization?.platformRole === 'platform-admin' ||
    authorization?.responsibilities.includes('owner');
  if (
    authorization &&
    !actorIsOwner &&
    (current.responsibilities.includes('admin') || nextResponsibilities.includes('admin'))
  ) {
    throw forbidden();
  }

  const storedResponsibilities = nextStatus === 'ended' ? [] : [...nextResponsibilities];
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .update(clubMemberships)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .returning();
    if (!membership) throw notFound('MEMBERSHIP_NOT_FOUND');

    if (input.responsibilities !== undefined || nextStatus === 'ended') {
      await tx
        .delete(clubResponsibilities)
        .where(
          and(eq(clubResponsibilities.clubId, clubId), eq(clubResponsibilities.userId, userId)),
        );
      if (storedResponsibilities.length > 0) {
        await tx.insert(clubResponsibilities).values(
          storedResponsibilities.map((responsibility) => ({
            clubId,
            userId,
            responsibility,
          })),
        );
      }
    }
    await tx.insert(auditLogs).values(
      auditValue({
        actorId,
        clubId,
        action: 'club.membership.update',
        entityType: 'club-membership',
        entityId: userId,
        metadata: {
          fromStatus: current.status,
          toStatus: nextStatus,
          fromResponsibilities: current.responsibilities,
          toResponsibilities: storedResponsibilities,
        },
      }),
    );
    return {
      ...membership,
      responsibilities: storedResponsibilities,
    };
  });
}

export async function removeClubMember(actorId: string, clubId: string, userId: string) {
  await updateClubMembership(actorId, clubId, userId, { status: 'ended' });
  return { userId, removed: true };
}

export async function transferClubOwnership(actorId: string, clubId: string, newOwnerId: string) {
  const authorization = await requireClubAccess(actorId, clubId);
  if (
    authorization.platformRole !== 'platform-admin' &&
    !authorization.responsibilities.includes('owner')
  ) {
    throw forbidden();
  }
  if (actorId === newOwnerId) throw new ServiceError('ALREADY_OWNER', 'error.invalidRequest', 409);
  const [target] = await db
    .select({
      status: clubMemberships.status,
      responsibilities: membershipResponsibilities,
    })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, newOwnerId)))
    .limit(1);
  if (!target) throw notFound('MEMBERSHIP_NOT_FOUND');
  if (target.status !== 'active') {
    throw new ServiceError('ACTIVE_MEMBERSHIP_REQUIRED', 'error.invalidRequest', 409);
  }
  if (target.responsibilities.includes('owner')) {
    throw new ServiceError('ALREADY_OWNER', 'error.invalidRequest', 409);
  }
  await db.transaction(async (tx) => {
    const [currentOwner] = await tx
      .select({ userId: clubResponsibilities.userId })
      .from(clubResponsibilities)
      .where(
        and(
          eq(clubResponsibilities.clubId, clubId),
          eq(clubResponsibilities.responsibility, 'owner'),
        ),
      )
      .limit(1)
      .for('update');
    if (!currentOwner) throw notFound('CLUB_OWNER_NOT_FOUND');
    await tx
      .delete(clubResponsibilities)
      .where(
        and(
          eq(clubResponsibilities.clubId, clubId),
          eq(clubResponsibilities.responsibility, 'owner'),
        ),
      );
    await tx.insert(clubResponsibilities).values({
      clubId,
      userId: newOwnerId,
      responsibility: 'owner',
    });
    await tx.insert(auditLogs).values(
      auditValue({
        actorId,
        clubId,
        action: 'club.owner.transfer',
        entityType: 'club-membership',
        entityId: newOwnerId,
        metadata: {
          previousOwnerId: currentOwner.userId,
          newOwnerId,
          newOwnerPreviousResponsibilities: target.responsibilities,
        },
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

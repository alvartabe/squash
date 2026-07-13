import { clubMemberships, clubs, users } from '@squash/db/schema';
import { canPerformClubAction, type ClubAction } from '@squash/domain';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './database';
import { forbidden, ServiceError } from './errors';
import { membershipResponsibilities } from './membership';
import { platformAccountSuspendedError } from './platform-suspension';

type AuthorizationDatabase = Pick<typeof db, 'select'>;

export async function getClubAuthorization(
  userId: string,
  clubId: string,
  database: AuthorizationDatabase = db,
) {
  const [result] = await database
    .select({
      platformRole: users.role,
      membershipStatus: clubMemberships.status,
      responsibilities: membershipResponsibilities,
      clubId: clubs.id,
      clubArchivedAt: clubs.archivedAt,
    })
    .from(users)
    .leftJoin(clubs, eq(clubs.id, clubId))
    .leftJoin(
      clubMemberships,
      and(eq(clubMemberships.userId, users.id), eq(clubMemberships.clubId, clubs.id)),
    )
    .where(eq(users.id, userId))
    .limit(1);
  return result ?? null;
}

export async function requireClubAccess(userId: string, clubId: string) {
  const result = await getClubAuthorization(userId, clubId);
  if (
    !result?.clubId ||
    (result.platformRole !== 'platform-admin' && result.membershipStatus !== 'active')
  ) {
    throw forbidden();
  }
  return result;
}

export async function requirePlatformAdmin(userId: string) {
  const [result] = await db
    .select({ role: users.role, platformSuspendedAt: users.platformSuspendedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (result?.role !== 'platform-admin') throw forbidden();
  if (result.platformSuspendedAt) throw platformAccountSuspendedError();
  return { role: result.role };
}

export async function requireRegisteredPlayer(userId: string) {
  const [player] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!player) throw forbidden();
  return player;
}

export async function requireActiveClubMembership(userId: string, clubId: string) {
  const [membership] = await db
    .select({
      status: clubMemberships.status,
      responsibilities: membershipResponsibilities,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(
      and(
        eq(clubMemberships.userId, userId),
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.status, 'active'),
        isNull(clubs.archivedAt),
      ),
    )
    .limit(1);
  if (!membership) throw forbidden();
  return membership;
}

export async function requireLockedActiveClubMembership(
  database: AuthorizationDatabase,
  userId: string,
  clubId: string,
) {
  const [club] = await database
    .select({ id: clubs.id, archivedAt: clubs.archivedAt })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .for('update');
  if (!club || club.archivedAt) throw forbidden();
  const [membership] = await database
    .select({
      status: clubMemberships.status,
      responsibilities: membershipResponsibilities,
    })
    .from(clubMemberships)
    .where(
      and(
        eq(clubMemberships.userId, userId),
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.status, 'active'),
      ),
    )
    .limit(1);
  if (!membership) throw forbidden();
  return membership;
}

export async function requireLockedActiveClub(database: AuthorizationDatabase, clubId: string) {
  const [club] = await database
    .select({ id: clubs.id, archivedAt: clubs.archivedAt })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .for('update');
  if (!club) throw forbidden();
  if (club.archivedAt) {
    throw new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409);
  }
  return club;
}

export async function requireClubAction(userId: string, clubId: string, action: ClubAction) {
  const result = await getClubAuthorization(userId, clubId);

  requireAuthorizedClubAction(result, action);
  requireClubLifecycleState(result, action);
  return result;
}

function requireAuthorizedClubAction(
  result: Awaited<ReturnType<typeof getClubAuthorization>>,
  action: ClubAction,
): asserts result is NonNullable<Awaited<ReturnType<typeof getClubAuthorization>>> {
  if (
    !result?.clubId ||
    !canPerformClubAction(
      result.platformRole,
      result.membershipStatus,
      result.responsibilities,
      action,
    )
  ) {
    throw forbidden();
  }
}

function requireClubLifecycleState(
  result: NonNullable<Awaited<ReturnType<typeof getClubAuthorization>>>,
  action: ClubAction,
) {
  if (result.clubArchivedAt && action !== 'club.restore') {
    throw new ServiceError('CLUB_ARCHIVED', 'error.invalidRequest', 409);
  }
  if (!result.clubArchivedAt && action === 'club.restore') {
    throw new ServiceError('CLUB_NOT_ARCHIVED', 'error.invalidRequest', 409);
  }
}

export async function requireLockedClubAction(
  database: AuthorizationDatabase,
  userId: string,
  clubId: string,
  action: ClubAction,
) {
  const [club] = await database
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1)
    .for('update');
  if (!club) throw forbidden();

  const result = await getClubAuthorization(userId, clubId, database);
  requireAuthorizedClubAction(result, action);
  requireClubLifecycleState(result, action);
  return result;
}

export async function requireMembershipRequestReviewer(userId: string, clubId: string) {
  const result = await getClubAuthorization(userId, clubId);
  if (
    !result?.clubId ||
    !canPerformClubAction(
      result.platformRole,
      result.membershipStatus,
      result.responsibilities,
      'membership-requests.review',
    )
  ) {
    throw forbidden();
  }
  return result;
}

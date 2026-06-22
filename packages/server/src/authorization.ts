import { clubMemberships, users } from '@squash/db/schema';
import { canPerformClubAction, type ClubAction } from '@squash/domain';
import { and, eq } from 'drizzle-orm';
import { db } from './database';
import { forbidden } from './errors';

export async function getClubAuthorization(userId: string, clubId: string) {
  const [result] = await db
    .select({ platformRole: users.role, clubRole: clubMemberships.role })
    .from(users)
    .leftJoin(
      clubMemberships,
      and(eq(clubMemberships.userId, users.id), eq(clubMemberships.clubId, clubId)),
    )
    .where(eq(users.id, userId))
    .limit(1);
  return result ?? null;
}

export async function requireClubAccess(userId: string, clubId: string) {
  const result = await getClubAuthorization(userId, clubId);
  if (!result || (result.platformRole !== 'platform-admin' && result.clubRole === null)) {
    throw forbidden();
  }
  return result;
}

export async function requirePlatformAdmin(userId: string) {
  const [result] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (result?.role !== 'platform-admin') throw forbidden();
  return result;
}

export async function requireClubAction(userId: string, clubId: string, action: ClubAction) {
  const result = await getClubAuthorization(userId, clubId);

  if (!result || !canPerformClubAction(result.platformRole, result.clubRole, action)) {
    throw forbidden();
  }
  return result;
}

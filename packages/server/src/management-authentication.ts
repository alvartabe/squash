import {
  accounts,
  clubMemberships,
  clubResponsibilities,
  clubs,
  managementSessions,
  users,
  verifications,
} from '@squash/db/schema';
import { and, eq, isNotNull, like } from 'drizzle-orm';
import { db } from './database';
import { forbidden, ServiceError, unauthorized } from './errors';
import { platformAccountSuspendedError } from './platform-suspension';

type ManagementAuthenticationDatabase = Pick<typeof db, 'select'>;
type ManagementSecurityRevocationDatabase = Pick<typeof db, 'transaction'>;

export type ManagementSecurityState = {
  userId: string;
  isPlatformSuspended: boolean;
  hasManagementAuthority: boolean;
  hasCredential: boolean;
  twoFactorEnabled: boolean;
};

export async function getManagementSecurityState(
  userId: string,
  database: ManagementAuthenticationDatabase = db,
): Promise<ManagementSecurityState | null> {
  const [user] = await database
    .select({
      id: users.id,
      role: users.role,
      platformSuspendedAt: users.platformSuspendedAt,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const [credential] = await database
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, 'credential'),
        isNotNull(accounts.password),
      ),
    )
    .limit(1);

  const responsibilities = await database
    .select({
      responsibility: clubResponsibilities.responsibility,
      clubArchivedAt: clubs.archivedAt,
    })
    .from(clubResponsibilities)
    .innerJoin(
      clubMemberships,
      and(
        eq(clubMemberships.clubId, clubResponsibilities.clubId),
        eq(clubMemberships.userId, clubResponsibilities.userId),
      ),
    )
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(and(eq(clubResponsibilities.userId, userId), eq(clubMemberships.status, 'active')));
  const hasEligibleClubResponsibility = responsibilities.some(
    ({ responsibility, clubArchivedAt }) => !clubArchivedAt || responsibility === 'owner',
  );

  return {
    userId: user.id,
    isPlatformSuspended: Boolean(user.platformSuspendedAt),
    hasManagementAuthority: user.role === 'platform-admin' || hasEligibleClubResponsibility,
    hasCredential: Boolean(credential),
    twoFactorEnabled: user.twoFactorEnabled === true,
  };
}

export function requireManagementSecurityState(
  state: ManagementSecurityState | null,
  hasManagementSession: boolean,
) {
  if (!state) throw unauthorized();
  if (state.isPlatformSuspended) throw platformAccountSuspendedError();
  if (!state.hasManagementAuthority) throw forbidden();
  if (!state.hasCredential) {
    throw new ServiceError(
      'MANAGEMENT_CREDENTIAL_REQUIRED',
      'error.managementCredentialRequired',
      403,
    );
  }
  if (!state.twoFactorEnabled) {
    throw new ServiceError('MFA_ENROLLMENT_REQUIRED', 'error.mfaEnrollmentRequired', 403);
  }
  if (!hasManagementSession) {
    throw new ServiceError('MFA_VERIFICATION_REQUIRED', 'error.mfaVerificationRequired', 403);
  }
  return state;
}

export async function requireManagementAuthentication(
  managementUserId: string | null,
  playerUserId: string | null,
  database: ManagementAuthenticationDatabase = db,
) {
  const userId = managementUserId ?? playerUserId;
  if (!userId) throw unauthorized();
  const state = await getManagementSecurityState(userId, database);
  return requireManagementSecurityState(state, Boolean(managementUserId));
}

export async function revokeManagementSecurityArtifacts(
  userId: string,
  database: ManagementSecurityRevocationDatabase = db,
) {
  await database.transaction(async (tx) => {
    await tx.delete(managementSessions).where(eq(managementSessions.userId, userId));
    await tx
      .delete(verifications)
      .where(
        and(eq(verifications.value, userId), like(verifications.identifier, 'trust-device-%')),
      );
  });
}

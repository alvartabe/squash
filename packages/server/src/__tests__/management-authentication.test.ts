import { managementSessions, verifications } from '@squash/db/schema';
import type { SQLWrapper } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  getManagementSecurityState,
  requireManagementSecurityState,
  revokeManagementSecurityArtifacts,
  type ManagementSecurityState,
} from '../management-authentication';

const dialect = new PgDialect();

function state(overrides: Partial<ManagementSecurityState> = {}): ManagementSecurityState {
  return {
    userId: 'manager-id',
    isPlatformSuspended: false,
    hasManagementAuthority: true,
    hasCredential: true,
    twoFactorEnabled: true,
    ...overrides,
  };
}

describe('management authentication boundary', () => {
  it.each([
    ['active Club Administrator', 'admin', null, true],
    ['active Coach', 'coach', null, true],
    ['archived Club Owner', 'owner', new Date('2026-07-01T00:00:00.000Z'), true],
    ['archived Club Administrator', 'admin', new Date('2026-07-01T00:00:00.000Z'), false],
    ['archived Coach', 'coach', new Date('2026-07-01T00:00:00.000Z'), false],
  ] as const)(
    'sets management eligibility for an %s',
    async (_label, responsibility, clubArchivedAt, expected) => {
      const userQuery = {
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 'manager-id', role: 'user', twoFactorEnabled: true }],
          }),
        }),
      };
      const credentialQuery = {
        from: () => ({
          where: () => ({ limit: async () => [{ id: 'credential-id' }] }),
        }),
      };
      const responsibilityQuery = {
        from: () => {
          const query = {
            innerJoin: () => query,
            where: async () => [{ responsibility, clubArchivedAt }],
          };
          return query;
        },
      };
      const database = {
        select: jest
          .fn()
          .mockReturnValueOnce(userQuery)
          .mockReturnValueOnce(credentialQuery)
          .mockReturnValueOnce(responsibilityQuery),
      };

      await expect(
        getManagementSecurityState('manager-id', database as never),
      ).resolves.toMatchObject({ hasManagementAuthority: expected });
    },
  );

  it.each([
    'Platform Administrator',
    'active Club Owner',
    'active Club Administrator',
    'active Coach',
  ])('allows an assured %s management session', () => {
    expect(requireManagementSecurityState(state(), true)).toMatchObject({
      userId: 'manager-id',
    });
  });

  it.each(['ordinary Player', 'Suspended Membership', 'Ended Membership'])(
    'does not treat an %s as management authority',
    () => {
      expect(() =>
        requireManagementSecurityState(state({ hasManagementAuthority: false }), true),
      ).toThrow(expect.objectContaining({ code: 'FORBIDDEN', status: 403 }));
    },
  );

  it('requires a credential for social-only management onboarding', () => {
    expect(() => requireManagementSecurityState(state({ hasCredential: false }), false)).toThrow(
      expect.objectContaining({
        code: 'MANAGEMENT_CREDENTIAL_REQUIRED',
        status: 403,
      }),
    );
  });

  it('blocks a credential session until MFA enrollment completes', () => {
    expect(() => requireManagementSecurityState(state({ twoFactorEnabled: false }), true)).toThrow(
      expect.objectContaining({ code: 'MFA_ENROLLMENT_REQUIRED', status: 403 }),
    );
  });

  it('does not accept twoFactorEnabled as current-session assurance', () => {
    expect(() => requireManagementSecurityState(state(), false)).toThrow(
      expect.objectContaining({ code: 'MFA_VERIFICATION_REQUIRED', status: 403 }),
    );
  });

  it('denies an OAuth/Player session both before and after MFA enrollment', () => {
    expect(() => requireManagementSecurityState(state({ twoFactorEnabled: false }), false)).toThrow(
      expect.objectContaining({ code: 'MFA_ENROLLMENT_REQUIRED' }),
    );
    expect(() => requireManagementSecurityState(state({ twoFactorEnabled: true }), false)).toThrow(
      expect.objectContaining({ code: 'MFA_VERIFICATION_REQUIRED' }),
    );
  });

  it('immediately blocks management after MFA is disabled', () => {
    expect(() => requireManagementSecurityState(state({ twoFactorEnabled: false }), true)).toThrow(
      expect.objectContaining({ code: 'MFA_ENROLLMENT_REQUIRED' }),
    );
  });

  it('rejects a stale management session when the Player is Platform Suspended', () => {
    expect(() =>
      requireManagementSecurityState(state({ isPlatformSuspended: true }), true),
    ).toThrow(
      expect.objectContaining({
        code: 'ACCOUNT_SUSPENDED',
        messageKey: 'error.accountSuspended',
        status: 403,
      }),
    );
  });

  it('revokes every management session and trusted-device record for the Player', async () => {
    const deletes: Array<{ table: unknown; condition: SQLWrapper }> = [];
    const transaction = {
      delete: (table: unknown) => ({
        where: async (condition: SQLWrapper) => {
          deletes.push({ table, condition });
        },
      }),
    };
    const database = {
      transaction: async (callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
    };

    await revokeManagementSecurityArtifacts('manager-id', database as never);

    expect(deletes.map(({ table }) => table)).toEqual([managementSessions, verifications]);
    const trustDelete = deletes[1];
    if (!trustDelete) {
      throw new Error('Expected trusted-device deletion.');
    }

    const trustDeletion = dialect.sqlToQuery(trustDelete.condition.getSQL());
    expect(trustDeletion.sql).toContain('"verifications"."value" = $1');
    expect(trustDeletion.sql).toContain('"verifications"."identifier" like $2');
    expect(trustDeletion.params).toEqual(['manager-id', 'trust-device-%']);
  });
});

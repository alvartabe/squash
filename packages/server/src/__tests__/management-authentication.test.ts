import { managementSessions, verifications } from '@squash/db/schema';
import type { SQLWrapper } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  requireManagementSecurityState,
  revokeManagementSecurityArtifacts,
  type ManagementSecurityState,
} from '../management-authentication';

const dialect = new PgDialect();

function state(overrides: Partial<ManagementSecurityState> = {}): ManagementSecurityState {
  return {
    userId: 'manager-id',
    hasManagementAuthority: true,
    hasCredential: true,
    twoFactorEnabled: true,
    ...overrides,
  };
}

describe('management authentication boundary', () => {
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

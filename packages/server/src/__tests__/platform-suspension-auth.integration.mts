import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { betterAuth } from 'better-auth';
import { ServiceError } from '../errors';
import { createPlatformSuspensionSessionGuard } from '../platform-suspension-authentication';

function createAuthHarness() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      emailVerified integer NOT NULL DEFAULT 0,
      image text,
      platformSuspendedAt integer,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );
    CREATE TABLE session (
      id text PRIMARY KEY,
      expiresAt integer NOT NULL,
      token text NOT NULL UNIQUE,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL,
      ipAddress text,
      userAgent text,
      userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE account (
      id text PRIMARY KEY,
      accountId text NOT NULL,
      providerId text NOT NULL,
      userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      accessToken text,
      refreshToken text,
      idToken text,
      accessTokenExpiresAt integer,
      refreshTokenExpiresAt integer,
      scope text,
      password text,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );
    CREATE TABLE verification (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      expiresAt integer NOT NULL,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );
  `);

  const requireActiveAccount = async (playerId: string) => {
    const account = database
      .prepare('SELECT platformSuspendedAt FROM user WHERE id = ?')
      .get(playerId) as { platformSuspendedAt: number | null } | undefined;
    if (account?.platformSuspendedAt) {
      throw new ServiceError('ACCOUNT_SUSPENDED', 'error.accountSuspended', 403);
    }
  };
  const instance = betterAuth({
    appName: 'Squash',
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-with-more-than-thirty-two-random-characters',
    database,
    emailAndPassword: { enabled: true },
    socialProviders: {
      google: {
        clientId: 'google-client',
        clientSecret: 'google-secret',
        verifyIdToken: async () => true,
        getUserInfo: async () => ({
          user: {
            id: 'google-player',
            name: 'Google Player',
            email: 'google@example.com',
            emailVerified: true,
          },
          data: {},
        }),
      },
      apple: {
        clientId: 'apple-client',
        clientSecret: 'apple-secret',
        verifyIdToken: async () => true,
        getUserInfo: async () => ({
          user: {
            id: 'apple-player',
            name: 'Apple Player',
            email: 'apple@example.com',
            emailVerified: true,
          },
          data: {},
        }),
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: createPlatformSuspensionSessionGuard(
            requireActiveAccount,
            async () => 'Your Squash access is suspended.',
          ),
        },
      },
    },
    rateLimit: { enabled: false },
  });
  return { database, instance };
}

function suspendByEmail(database: DatabaseSync, email: string) {
  database
    .prepare('UPDATE user SET platformSuspendedAt = ? WHERE email = ?')
    .run(Date.now(), email);
  database
    .prepare('DELETE FROM session WHERE userId = (SELECT id FROM user WHERE email = ?)')
    .run(email);
}

function rejectsAsSuspended(operation: Promise<unknown>) {
  return assert.rejects(
    operation,
    (error: unknown) => (error as { body?: { code?: string } }).body?.code === 'ACCOUNT_SUSPENDED',
  );
}

test('email/password authentication rejects a suspended Player without creating a session', async () => {
  const { database, instance } = createAuthHarness();
  await instance.api.signUpEmail({
    body: { email: 'credential@example.com', password: 'password123', name: 'Credential Player' },
  });
  suspendByEmail(database, 'credential@example.com');

  await rejectsAsSuspended(
    instance.api.signInEmail({
      body: { email: 'credential@example.com', password: 'password123' },
    }),
  );
  assert.equal(
    (database.prepare('SELECT count(*) AS count FROM session').get() as { count: number }).count,
    0,
  );
});

for (const provider of ['google', 'apple'] as const) {
  test(`${provider} authentication rejects a suspended Player without creating a session`, async () => {
    const { database, instance } = createAuthHarness();
    await instance.api.signInSocial({
      body: { provider, idToken: { token: `${provider}-active-token` } },
    });
    suspendByEmail(database, `${provider}@example.com`);

    await rejectsAsSuspended(
      instance.api.signInSocial({
        body: { provider, idToken: { token: `${provider}-suspended-token` } },
      }),
    );
    assert.equal(
      (database.prepare('SELECT count(*) AS count FROM session').get() as { count: number }).count,
      0,
    );
  });
}

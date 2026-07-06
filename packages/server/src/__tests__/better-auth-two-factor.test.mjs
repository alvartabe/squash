import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'expect';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { bearer, twoFactor } from 'better-auth/plugins';
import { base32 } from '@better-auth/utils/base32';

class CookieJar {
  values = new Map();

  absorb(headers) {
    for (const setCookie of headers.getSetCookie()) {
      const [pair = '', ...attributes] = setCookie.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (attributes.some((attribute) => attribute.trim().toLowerCase() === 'max-age=0')) {
        this.values.delete(name);
      } else {
        this.values.set(name, value);
      }
    }
  }

  headers() {
    return new Headers({
      cookie: [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
    });
  }

  get(name) {
    return this.values.get(name);
  }

  set(name, value) {
    this.values.set(name, value);
  }
}

function createTestAuth() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      emailVerified integer NOT NULL DEFAULT 0,
      image text,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL,
      twoFactorEnabled integer DEFAULT 0
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
    CREATE TABLE managementSession (
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
    CREATE TABLE twoFactor (
      id text PRIMARY KEY,
      secret text NOT NULL,
      backupCodes text NOT NULL,
      userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      verified integer DEFAULT 1
    );
  `);
  const instance = betterAuth({
    appName: 'Squash',
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-with-more-than-thirty-two-random-characters',
    database,
    emailAndPassword: { enabled: true },
    plugins: [
      bearer(),
      twoFactor({
        issuer: 'Squash',
        allowPasswordless: true,
        skipVerificationOnEnable: false,
      }),
    ],
    rateLimit: { enabled: false },
  });
  return { instance, database };
}

async function signUpAndEnroll() {
  const { instance, database } = createTestAuth();
  const cookies = new CookieJar();
  const signup = await instance.api.signUpEmail({
    body: { email: 'manager@example.com', password: 'password123', name: 'Manager' },
    returnHeaders: true,
  });
  cookies.absorb(signup.headers);
  const enrollment = await instance.api.enableTwoFactor({
    body: { password: 'password123' },
    headers: cookies.headers(),
    returnHeaders: true,
  });
  const encodedSecret = new URL(enrollment.response.totpURI).searchParams.get('secret');
  if (!encodedSecret) throw new Error('TOTP secret missing from enrollment URI.');
  const secret = new TextDecoder().decode(base32.decode(encodedSecret));
  const currentCode = async () => (await instance.api.generateTOTP({ body: { secret } })).code;
  return {
    instance,
    database,
    cookies,
    secret,
    totpURI: enrollment.response.totpURI,
    currentCode,
    backupCodes: enrollment.response.backupCodes,
  };
}

describe('Better Auth 1.6.20 two-factor mechanisms', () => {
  it('uses server-side setPassword for a fresh social-only onboarding session', async () => {
    const { instance, database } = createTestAuth();
    const context = await instance.$context;
    const user = await context.internalAdapter.createUser({
      email: 'social-manager@example.com',
      emailVerified: true,
      name: 'Social Manager',
    });
    await context.internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'google',
      accountId: 'google-social-manager',
    });
    const session = await context.internalAdapter.createSession(user.id);
    await instance.api.setPassword({
      body: { newPassword: 'password123' },
      headers: new Headers({ authorization: `Bearer ${session.token}` }),
    });

    const credential = database
      .prepare(`SELECT password FROM account WHERE providerId = 'credential'`)
      .get();
    expect(credential.password).not.toBe('password123');
    expect(credential.password).toBeTruthy();
    await expect(
      instance.api.signInEmail({
        body: { email: 'social-manager@example.com', password: 'password123' },
      }),
    ).resolves.toMatchObject({ user: { id: user.id } });
  });

  it('cannot replay a Player session token against an isolated management session model', async () => {
    const { instance, database } = createTestAuth();
    const playerCookies = new CookieJar();
    const signup = await instance.api.signUpEmail({
      body: { email: 'player@example.com', password: 'password123', name: 'Player' },
      returnHeaders: true,
    });
    playerCookies.absorb(signup.headers);
    const playerCookie = playerCookies.get('better-auth.session_token');
    expect(playerCookie).toBeTruthy();

    const management = betterAuth({
      baseURL: 'http://localhost:3000',
      basePath: '/api/management-auth',
      secret: 'test-secret-with-more-than-thirty-two-random-characters',
      database,
      session: { modelName: 'managementSession' },
      advanced: { cookiePrefix: 'squash-management' },
      emailAndPassword: { enabled: true, disableSignUp: true },
      rateLimit: { enabled: false },
    });
    const replay = new Headers({
      cookie: `squash-management.session_token=${playerCookie}`,
    });

    await expect(management.api.getSession({ headers: replay })).resolves.toBeNull();
    expect(database.prepare('SELECT COUNT(*) AS count FROM managementSession').get()).toMatchObject(
      { count: 0 },
    );
  });

  it('revokes the pre-MFA enrollment session and requires a fresh credential plus TOTP login', async () => {
    const { instance: playerAuth, database } = createTestAuth();
    await playerAuth.api.signUpEmail({
      body: { email: 'new-manager@example.com', password: 'password123', name: 'New Manager' },
    });
    const management = betterAuth({
      appName: 'Squash',
      baseURL: 'http://localhost:3000',
      basePath: '/api/management-auth',
      secret: 'test-secret-with-more-than-thirty-two-random-characters',
      database,
      session: { modelName: 'managementSession' },
      advanced: { cookiePrefix: 'squash-management' },
      emailAndPassword: { enabled: true, disableSignUp: true },
      plugins: [
        twoFactor({
          issuer: 'Squash',
          allowPasswordless: true,
          skipVerificationOnEnable: false,
        }),
      ],
      hooks: {
        before: createAuthMiddleware(async (context) => {
          if (context.path === '/two-factor/verify-totp') {
            await getSessionFromCtx(context, { disableCookieCache: true });
          }
        }),
        after: createAuthMiddleware(async (context) => {
          if (context.path !== '/two-factor/verify-totp') return;
          const enrollmentSession = context.context.session;
          if (!enrollmentSession?.session || enrollmentSession.user.twoFactorEnabled === true) {
            return;
          }
          database
            .prepare('DELETE FROM managementSession WHERE userId = ?')
            .run(enrollmentSession.user.id);
        }),
      },
      rateLimit: { enabled: false },
    });
    const cookies = new CookieJar();
    const credentialSession = await management.api.signInEmail({
      body: { email: 'new-manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    cookies.absorb(credentialSession.headers);
    const enrollment = await management.api.enableTwoFactor({
      body: { password: 'password123' },
      headers: cookies.headers(),
    });
    const encodedSecret = new URL(enrollment.totpURI).searchParams.get('secret');
    if (!encodedSecret) throw new Error('TOTP secret missing from enrollment URI.');
    const secret = new TextDecoder().decode(base32.decode(encodedSecret));
    const code = (await management.api.generateTOTP({ body: { secret } })).code;
    const verified = await management.api.verifyTOTP({
      body: { code, trustDevice: false },
      headers: cookies.headers(),
      returnHeaders: true,
    });
    cookies.absorb(verified.headers);
    await expect(management.api.getSession({ headers: cookies.headers() })).resolves.toBeNull();

    const freshCredential = await management.api.signInEmail({
      body: { email: 'new-manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    cookies.absorb(freshCredential.headers);
    expect(freshCredential.response).toMatchObject({ twoFactorRedirect: true });
    const freshCode = (await management.api.generateTOTP({ body: { secret } })).code;
    const assured = await management.api.verifyTOTP({
      body: { code: freshCode, trustDevice: false },
      headers: cookies.headers(),
      returnHeaders: true,
    });
    cookies.absorb(assured.headers);
    await expect(management.api.getSession({ headers: cookies.headers() })).resolves.toMatchObject({
      user: { email: 'new-manager@example.com' },
    });
  });

  it('does not activate MFA until the enrollment TOTP is verified', async () => {
    const harness = await signUpAndEnroll();
    expect(new URL(harness.totpURI).searchParams.get('issuer')).toBe('Squash');
    const twoFactorRecord = harness.database
      .prepare('SELECT secret, backupCodes, verified FROM twoFactor')
      .get();
    expect(harness.database.prepare('SELECT twoFactorEnabled FROM user').get()).toMatchObject({
      twoFactorEnabled: 0,
    });
    expect(twoFactorRecord).toMatchObject({ verified: 0 });
    expect(twoFactorRecord.secret).not.toBe(harness.secret);
    for (const backupCode of harness.backupCodes) {
      expect(twoFactorRecord.backupCodes).not.toContain(backupCode);
    }

    const verified = await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: false },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(verified.headers);

    expect(harness.database.prepare('SELECT twoFactorEnabled FROM user').get()).toMatchObject({
      twoFactorEnabled: 1,
    });
    expect(harness.database.prepare('SELECT verified FROM twoFactor').get()).toMatchObject({
      verified: 1,
    });
    expect(JSON.stringify(verified.response)).not.toContain(harness.secret);
    for (const backupCode of harness.backupCodes) {
      expect(JSON.stringify(verified.response)).not.toContain(backupCode);
    }
  });

  it('challenges credential sign-in and rejects invalid or expired challenges', async () => {
    const harness = await signUpAndEnroll();
    await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: false },
      headers: harness.cookies.headers(),
    });
    await harness.instance.api.signOut({ headers: harness.cookies.headers() });

    const challenge = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    harness.cookies.absorb(challenge.headers);
    expect(challenge.response).toMatchObject({ twoFactorRedirect: true });

    await expect(
      harness.instance.api.verifyTOTP({
        body: { code: '000000', trustDevice: false },
        headers: harness.cookies.headers(),
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_CODE' } });

    harness.database
      .prepare(`UPDATE verification SET expiresAt = ? WHERE identifier LIKE '2fa-%'`)
      .run(Date.now() - 1);
    await expect(
      harness.instance.api.verifyTOTP({
        body: { code: await harness.currentCode(), trustDevice: false },
        headers: harness.cookies.headers(),
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_TWO_FACTOR_COOKIE' } });
  });

  it('consumes backup codes once and regeneration invalidates old codes', async () => {
    const harness = await signUpAndEnroll();
    const enrolled = await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: false },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(enrolled.headers);

    const oldCode = harness.backupCodes[0];
    const regenerated = await harness.instance.api.generateBackupCodes({
      body: { password: 'password123' },
      headers: harness.cookies.headers(),
    });
    await harness.instance.api.signOut({ headers: harness.cookies.headers() });

    const challenge = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    harness.cookies.absorb(challenge.headers);
    await expect(
      harness.instance.api.verifyBackupCode({
        body: { code: oldCode, trustDevice: false },
        headers: harness.cookies.headers(),
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_BACKUP_CODE' } });

    const validCode = regenerated.backupCodes[0];
    const recovered = await harness.instance.api.verifyBackupCode({
      body: { code: validCode, trustDevice: false },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(recovered.headers);
    await harness.instance.api.signOut({ headers: harness.cookies.headers() });
    const secondChallenge = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    harness.cookies.absorb(secondChallenge.headers);
    await expect(
      harness.instance.api.verifyBackupCode({
        body: { code: validCode, trustDevice: false },
        headers: harness.cookies.headers(),
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_BACKUP_CODE' } });
  });

  it('uses a rolling signed trusted-device cookie and rejects invalid, expired, and revoked trust', async () => {
    const harness = await signUpAndEnroll();
    const enrolled = await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: false },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(enrolled.headers);
    await harness.instance.api.signOut({ headers: harness.cookies.headers() });
    const challenge = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    harness.cookies.absorb(challenge.headers);
    const trusted = await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: true },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    expect(
      trusted.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('better-auth.trust_device=')),
    ).toContain('Max-Age=2592000');
    harness.cookies.absorb(trusted.headers);
    const firstTrustCookie = harness.cookies.get('better-auth.trust_device');
    expect(firstTrustCookie).toBeTruthy();

    await harness.instance.api.signOut({ headers: harness.cookies.headers() });
    const trustedSignIn = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(trustedSignIn.headers);
    expect(trustedSignIn.response).not.toHaveProperty('twoFactorRedirect');
    expect(harness.cookies.get('better-auth.trust_device')).not.toBe(firstTrustCookie);

    await harness.instance.api.signOut({ headers: harness.cookies.headers() });
    const validTrustCookie = harness.cookies.get('better-auth.trust_device');
    if (!validTrustCookie) throw new Error('Trusted-device cookie was not set.');
    harness.cookies.set('better-auth.trust_device', `${validTrustCookie}tampered`);
    const invalidTrust = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      headers: harness.cookies.headers(),
    });
    expect(invalidTrust).toMatchObject({ twoFactorRedirect: true });

    harness.cookies.set('better-auth.trust_device', validTrustCookie);
    harness.database
      .prepare(`UPDATE verification SET expiresAt = ? WHERE identifier LIKE 'trust-device-%'`)
      .run(Date.now() - 1);
    const expiredTrust = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      headers: harness.cookies.headers(),
    });
    expect(expiredTrust).toMatchObject({ twoFactorRedirect: true });

    harness.database
      .prepare(`DELETE FROM verification WHERE identifier LIKE 'trust-device-%'`)
      .run();
    const revokedTrust = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      headers: harness.cookies.headers(),
    });
    expect(revokedTrust).toMatchObject({ twoFactorRedirect: true });
  });

  it('expires current trusted-device access when MFA is disabled', async () => {
    const harness = await signUpAndEnroll();
    const enrolled = await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: false },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(enrolled.headers);
    await harness.instance.api.signOut({ headers: harness.cookies.headers() });
    const challenge = await harness.instance.api.signInEmail({
      body: { email: 'manager@example.com', password: 'password123' },
      returnHeaders: true,
    });
    harness.cookies.absorb(challenge.headers);
    const trusted = await harness.instance.api.verifyTOTP({
      body: { code: await harness.currentCode(), trustDevice: true },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(trusted.headers);
    expect(harness.cookies.get('better-auth.trust_device')).toBeTruthy();

    const disabled = await harness.instance.api.disableTwoFactor({
      body: { password: 'password123' },
      headers: harness.cookies.headers(),
      returnHeaders: true,
    });
    harness.cookies.absorb(disabled.headers);

    expect(harness.cookies.get('better-auth.trust_device')).toBeUndefined();
    expect(harness.database.prepare('SELECT twoFactorEnabled FROM user').get()).toMatchObject({
      twoFactorEnabled: 0,
    });
    expect(harness.database.prepare('SELECT COUNT(*) AS count FROM twoFactor').get()).toMatchObject(
      {
        count: 0,
      },
    );
  });
});

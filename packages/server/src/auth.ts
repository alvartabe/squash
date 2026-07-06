import { expo } from '@better-auth/expo';
import {
  accounts,
  managementSessions,
  sessions,
  twoFactors,
  users,
  verifications,
} from '@squash/db/schema';
import { resolveLocale, translate, type Locale, type MessageKey } from '@squash/i18n';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from './database';
import { renderAuthEmail } from './emails';
import { revokeManagementSecurityArtifacts } from './management-authentication';

function emailClient() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

async function getUserLocale(userId: string): Promise<Locale> {
  const [user] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return resolveLocale(user?.locale);
}

async function sendAuthEmail(
  to: string,
  locale: Locale,
  subjectKey: MessageKey,
  headingKey: MessageKey,
  bodyKey: MessageKey,
  actionKey: MessageKey,
  url: string,
) {
  const client = emailClient();
  const subject = translate(locale, subjectKey);
  const from = process.env.EMAIL_FROM ?? 'Squash <noreply@example.com>';
  const logDevelopmentLink = (reason?: string) => {
    if (reason) console.warn(`[auth email fallback] ${reason}`);
    console.info(`[auth email] ${subject}: ${to} -> ${url}`);
  };
  if (!client || (process.env.NODE_ENV !== 'production' && from.includes('example.com'))) {
    if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is required.');
    logDevelopmentLink(
      from.includes('example.com') ? 'EMAIL_FROM uses the placeholder domain.' : undefined,
    );
    return;
  }
  const html = await renderAuthEmail({ locale, headingKey, bodyKey, actionKey, url });
  try {
    const result = await client.emails.send({ from, to, subject, html });
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
    logDevelopmentLink(error instanceof Error ? error.message : 'Resend rejected the email.');
  }
}

const trustedOrigins = [
  'squash://',
  'squash://*',
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ...(process.env.NODE_ENV === 'development' ? ['exp://', 'exp://**'] : []),
];

function managementAuthBaseURL() {
  if (!process.env.BETTER_AUTH_URL) return undefined;
  const url = new URL(process.env.BETTER_AUTH_URL);
  url.pathname = '/api/management-auth';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

const additionalUserFields = {
  locale: { type: 'string' as const, required: false, defaultValue: 'en-US' },
  timeZone: { type: 'string' as const, required: false, defaultValue: 'UTC' },
};

const sendResetPassword = async ({
  user,
  url,
}: {
  user: { id: string; email: string };
  url: string;
}) =>
  sendAuthEmail(
    user.email,
    await getUserLocale(user.id),
    'email.reset.subject',
    'email.reset.heading',
    'email.reset.body',
    'email.reset.action',
    url,
  );

const sendVerificationEmail = async ({
  user,
  url,
}: {
  user: { id: string; email: string };
  url: string;
}) =>
  sendAuthEmail(
    user.email,
    await getUserLocale(user.id),
    'email.verify.subject',
    'email.verify.heading',
    'email.verify.body',
    'email.verify.action',
    url,
  );

const onPasswordReset = async ({ user }: { user: { id: string } }) => {
  await revokeManagementSecurityArtifacts(user.id);
};

export const auth = betterAuth({
  appName: 'Squash',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  plugins: [expo()],
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset,
    sendResetPassword,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
    },
  },
  user: { additionalFields: additionalUserFields },
  rateLimit: { enabled: true, window: 60, max: 100 },
});

export const managementAuth = betterAuth({
  appName: 'Squash',
  baseURL: managementAuthBaseURL(),
  basePath: '/api/management-auth',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      managementSession: managementSessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
    },
  }),
  session: { modelName: 'managementSession' },
  advanced: { cookiePrefix: 'squash-management' },
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset,
    sendResetPassword,
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: false,
    sendVerificationEmail,
  },
  user: { additionalFields: additionalUserFields },
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
      const session = context.context.session;
      if (!session?.session) return;
      if (context.path === '/two-factor/disable') {
        await revokeManagementSecurityArtifacts(session.user.id);
        return;
      }
      if (context.path === '/two-factor/verify-totp' && session.user.twoFactorEnabled !== true) {
        await revokeManagementSecurityArtifacts(session.user.id);
      }
    }),
  },
  rateLimit: { enabled: true, window: 60, max: 100 },
});

export type AuthSession = typeof auth.$Infer.Session;
export type ManagementAuthSession = typeof managementAuth.$Infer.Session;

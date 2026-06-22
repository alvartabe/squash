import { expo } from '@better-auth/expo';
import { accounts, sessions, users, verifications } from '@squash/db/schema';
import { resolveLocale, translate, type Locale, type MessageKey } from '@squash/i18n';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from './database';
import { renderAuthEmail } from './emails';

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

export const auth = betterAuth({
  appName: 'Squash',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  plugins: [expo()],
  trustedOrigins: [
    'squash://',
    'squash://*',
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    ...(process.env.NODE_ENV === 'development' ? ['exp://', 'exp://**'] : []),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) =>
      sendAuthEmail(
        user.email,
        await getUserLocale(user.id),
        'email.reset.subject',
        'email.reset.heading',
        'email.reset.body',
        'email.reset.action',
        url,
      ),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) =>
      sendAuthEmail(
        user.email,
        await getUserLocale(user.id),
        'email.verify.subject',
        'email.verify.heading',
        'email.verify.body',
        'email.verify.action',
        url,
      ),
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
  user: {
    additionalFields: {
      locale: { type: 'string', required: false, defaultValue: 'en-US' },
      timeZone: { type: 'string', required: false, defaultValue: 'UTC' },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 100 },
});

export type AuthSession = typeof auth.$Infer.Session;

import { AuthCard } from '@/components/auth/auth-card';
import { internalCallbackPath } from '@/src/lib/internal-redirect';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  return <AuthCard mode="signup" callbackURL={internalCallbackPath(callbackURL)} />;
}

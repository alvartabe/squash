import { AuthCard } from '@/components/auth/auth-card';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  return (
    <AuthCard
      mode="signup"
      callbackURL={callbackURL?.startsWith('/') ? callbackURL : '/workspace'}
    />
  );
}

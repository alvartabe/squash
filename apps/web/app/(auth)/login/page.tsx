import { AuthCard } from '@/components/auth/auth-card';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  return (
    <AuthCard
      mode="login"
      callbackURL={callbackURL?.startsWith('/') ? callbackURL : '/workspace'}
    />
  );
}

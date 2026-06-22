import { AuthCard } from '@/components/auth/auth-card';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AuthCard mode="reset" token={token} />;
}

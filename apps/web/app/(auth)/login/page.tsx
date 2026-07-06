import { AuthCard } from '@/components/auth/auth-card';
import {
  authenticationBoundaryForCallback,
  internalCallbackPath,
} from '@/src/lib/internal-redirect';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const safeCallback = internalCallbackPath(callbackURL);
  return (
    <AuthCard
      mode="login"
      callbackURL={safeCallback}
      authenticationBoundary={authenticationBoundaryForCallback(safeCallback)}
    />
  );
}

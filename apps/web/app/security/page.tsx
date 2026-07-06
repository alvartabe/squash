import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getManagementSecurityState } from '@squash/server';
import { auth, managementAuth } from '@squash/server/auth';
import { SecuritySetup } from '@/components/auth/security-setup';

export default async function SecurityPage() {
  const requestHeaders = await headers();
  const managementSession = await managementAuth.api.getSession({ headers: requestHeaders });
  const playerSession = managementSession
    ? null
    : await auth.api.getSession({ headers: requestHeaders });
  const session = managementSession ?? playerSession;
  if (!session) redirect('/security-onboarding');

  const state = await getManagementSecurityState(session.user.id);
  if (!state?.hasManagementAuthority) redirect('/');

  if (!state.hasCredential) {
    return <SecuritySetup email={session.user.email} stage="password" />;
  }
  if (!managementSession) redirect('/login?callbackURL=/security');
  return (
    <SecuritySetup
      email={session.user.email}
      stage={state.twoFactorEnabled ? 'enabled' : 'enroll'}
    />
  );
}

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, managementAuth } from '@squash/server/auth';
import { getCurrentWorkspaceUser, getManagementSecurityState } from '@squash/server';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const session = await managementAuth.api.getSession({ headers: requestHeaders });
  if (!session) {
    const playerSession = await auth.api.getSession({ headers: requestHeaders });
    if (playerSession) {
      const state = await getManagementSecurityState(playerSession.user.id);
      if (state?.hasManagementAuthority && !state.hasCredential) redirect('/security');
      if (state?.hasManagementAuthority && !state.twoFactorEnabled) {
        redirect('/login?callbackURL=/security');
      }
    }
    redirect('/login?callbackURL=/workspace');
  }
  const security = await getManagementSecurityState(session.user.id);
  if (!security?.hasManagementAuthority) redirect('/');
  if (!security.hasCredential || !security.twoFactorEnabled) redirect('/security');
  const workspace = await getCurrentWorkspaceUser(session.user.id);
  if (!workspace.workspaceAccess) redirect('/');
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

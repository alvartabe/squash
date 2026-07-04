import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@squash/server/auth';
import { getCurrentWorkspaceUser } from '@squash/server';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login?callbackURL=/workspace');
  const workspace = await getCurrentWorkspaceUser(session.user.id);
  if (!workspace.workspaceAccess) redirect('/');
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

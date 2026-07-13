import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  requireManagementAuthentication,
  requirePlatformAdmin,
  ServiceError,
} from '@squash/server';
import { managementAuth } from '@squash/server/auth';
import { AuditIndex } from '@/components/platform/audit-index';

export default async function PlatformAuditPage() {
  const session = await managementAuth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login?callbackURL=/workspace/platform/audit');

  try {
    const security = await requireManagementAuthentication(session.user.id, null);
    await requirePlatformAdmin(security.userId);
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  return <AuditIndex />;
}

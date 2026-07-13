import { auth } from '@squash/server/auth';
import {
  getManagementSecurityState,
  requireActivePlatformAccount,
  ServiceError,
} from '@squash/server';
import { errorResponse } from '@/src/http';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new ServiceError('UNAUTHORIZED', 'error.unauthorized', 401);
    await requireActivePlatformAccount(session.user.id);
    const state = await getManagementSecurityState(session.user.id);
    if (!state?.hasManagementAuthority) {
      throw new ServiceError('FORBIDDEN', 'error.forbidden', 403);
    }
    if (state.hasCredential) {
      throw new ServiceError('MANAGEMENT_CREDENTIAL_EXISTS', 'error.invalidRequest', 409);
    }
    const body = (await request.json()) as { newPassword?: unknown };
    await auth.api.setPassword({
      body: { newPassword: typeof body.newPassword === 'string' ? body.newPassword : '' },
      headers: request.headers,
    });
    return auth.api.signOut({ headers: request.headers, asResponse: true });
  } catch (error) {
    return errorResponse(error);
  }
}

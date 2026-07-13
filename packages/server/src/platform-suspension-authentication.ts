import { APIError } from 'better-auth';
import { ServiceError } from './errors';

type RequirePlatformAccountAccess = (playerId: string) => Promise<unknown>;
type SuspendedAccountMessage = (playerId: string) => Promise<string>;

export function createPlatformSuspensionSessionGuard(
  requirePlatformAccountAccess: RequirePlatformAccountAccess,
  suspendedAccountMessage: SuspendedAccountMessage,
) {
  return async (session: { userId: string }) => {
    try {
      await requirePlatformAccountAccess(session.userId);
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'ACCOUNT_SUSPENDED') {
        throw new APIError('FORBIDDEN', {
          code: error.code,
          message: await suspendedAccountMessage(session.userId),
        });
      }
      throw error;
    }
  };
}

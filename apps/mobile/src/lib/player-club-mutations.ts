import { queryKeys } from '@squash/api-client';
import type { MessageKey } from '@squash/i18n';
import type { QueryClient } from '@tanstack/react-query';

export async function refreshPlayerClubQueries(
  queryClient: QueryClient,
  clubId: string,
  playerId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.clubDiscovery(), playerId],
    }),
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.clubProfile(clubId), playerId],
    }),
  ]);
}

export function invitationAcceptanceErrorKey(error: unknown): MessageKey {
  const code = (
    error as {
      response?: { data?: { error?: { code?: string } } };
    }
  ).response?.data?.error?.code;

  switch (code) {
    case 'INVITATION_EXPIRED':
      return 'playerClubs.invitationExpired';
    case 'INVITATION_REVOKED':
      return 'playerClubs.invitationRevoked';
    case 'CLUB_ARCHIVED':
      return 'playerClubs.invitationArchived';
    case 'INVITATION_UNAVAILABLE':
    case 'INVITATION_NOT_FOUND':
      return 'playerClubs.invitationUnavailable';
    default:
      return 'playerClubs.invitationAcceptError';
  }
}

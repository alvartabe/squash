import { queryKeys } from '@squash/api-client';
import {
  invitationAcceptanceErrorKey,
  refreshPlayerClubQueries,
} from '@/src/lib/player-club-mutations';

describe('Player Club mutation behavior', () => {
  it('refreshes Club discovery and the Club Profile after success', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries };

    await refreshPlayerClubQueries(
      queryClient as never,
      '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
      'player-id',
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [...queryKeys.clubDiscovery(), 'player-id'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [...queryKeys.clubProfile('2d44fd7a-eac8-4a72-84e8-b3b46812f606'), 'player-id'],
    });
  });

  it.each([
    ['INVITATION_EXPIRED', 'playerClubs.invitationExpired'],
    ['INVITATION_REVOKED', 'playerClubs.invitationRevoked'],
    ['CLUB_ARCHIVED', 'playerClubs.invitationArchived'],
    ['INVITATION_UNAVAILABLE', 'playerClubs.invitationUnavailable'],
    ['INTERNAL_ERROR', 'playerClubs.invitationAcceptError'],
  ] as const)('maps %s to useful localized copy', (code, key) => {
    expect(
      invitationAcceptanceErrorKey({
        response: { data: { error: { code } } },
      }),
    ).toBe(key);
  });
});

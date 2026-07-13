import { requireActivePlatformAccount } from '../platform-suspension';

function platformAccountDatabase(platformSuspendedAt: Date | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 'player-id', platformSuspendedAt }],
        }),
      }),
    }),
  };
}

describe('Platform Suspension authentication enforcement', () => {
  it('rejects persisted access for a suspended Player', async () => {
    await expect(
      requireActivePlatformAccount(
        'player-id',
        platformAccountDatabase(new Date('2026-07-13T15:00:00.000Z')) as never,
      ),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
      messageKey: 'error.accountSuspended',
      status: 403,
    });
  });

  it('allows a reactivated Player to authenticate again', async () => {
    await expect(
      requireActivePlatformAccount('player-id', platformAccountDatabase(null) as never),
    ).resolves.toEqual({ id: 'player-id', platformSuspendedAt: null });
  });
});

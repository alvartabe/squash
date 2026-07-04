import {
  membershipRequestListQuerySchema,
  membershipRequestSchema,
  membershipRequestStatusSchema,
} from '@squash/contracts';

describe('Membership Request contracts', () => {
  it.each(['pending', 'approved', 'rejected', 'cancelled'])(
    'accepts the documented %s status',
    (status) => {
      expect(membershipRequestStatusSchema.parse(status)).toBe(status);
    },
  );

  it('represents the immutable submission and its optional resolution', () => {
    const submittedAt = new Date().toISOString();
    expect(
      membershipRequestSchema.parse({
        id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
        clubId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
        playerId: 'player-id',
        playerName: 'Player',
        playerImage: null,
        status: 'pending',
        submittedAt,
        resolvedAt: null,
        resolvedById: null,
      }),
    ).toMatchObject({ status: 'pending', submittedAt, resolvedAt: null });
  });

  it('supports filtering a review queue by status', () => {
    expect(membershipRequestListQuerySchema.parse({ status: 'rejected' })).toEqual({
      page: 0,
      pageSize: 15,
      search: '',
      status: 'rejected',
    });
  });
});

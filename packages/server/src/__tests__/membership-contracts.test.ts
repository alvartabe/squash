import {
  clubMemberSchema,
  clubResponsibilitiesSchema,
  inviteClubMemberSchema,
  membershipStatusSchema,
  updateClubMemberSchema,
} from '@squash/contracts';

describe('club membership contracts', () => {
  it.each(['active', 'suspended', 'ended'])('accepts the %s Membership Status', (status) => {
    expect(membershipStatusSchema.parse(status)).toBe(status);
  });

  it('accepts independently composed responsibilities', () => {
    expect(clubResponsibilitiesSchema.parse(['admin', 'coach'])).toEqual(['admin', 'coach']);
  });

  it('rejects duplicate responsibilities', () => {
    expect(() => clubResponsibilitiesSchema.parse(['coach', 'coach'])).toThrow();
  });

  it('requires at least one membership change', () => {
    expect(() => updateClubMemberSchema.parse({})).toThrow();
    expect(updateClubMemberSchema.parse({ status: 'suspended' })).toEqual({
      status: 'suspended',
    });
    expect(updateClubMemberSchema.parse({ responsibilities: ['admin', 'coach'] })).toEqual({
      responsibilities: ['admin', 'coach'],
    });
  });

  it('represents a Player invitation with no responsibility', () => {
    expect(
      inviteClubMemberSchema.parse({
        email: 'player@example.com',
        responsibility: null,
        locale: 'en-US',
      }),
    ).toMatchObject({ responsibility: null });
  });

  it('represents status and all responsibilities in member responses', () => {
    expect(
      clubMemberSchema.parse({
        userId: 'player-id',
        name: 'Player',
        email: 'player@example.com',
        image: null,
        membershipStatus: 'suspended',
        responsibilities: ['admin', 'coach'],
        joinedAt: new Date().toISOString(),
      }),
    ).toMatchObject({
      membershipStatus: 'suspended',
      responsibilities: ['admin', 'coach'],
    });
  });
});

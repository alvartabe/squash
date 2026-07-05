import {
  clubDiscoveryItemSchema,
  clubDiscoveryRelationshipSchema,
  clubProfileDetailSchema,
  paginationQuerySchema,
} from '@squash/contracts';

describe('Club discovery contracts', () => {
  it.each(['active', 'suspended', 'request-pending', 'invited', 'none'])(
    'accepts the documented %s relationship',
    (relationship) => {
      expect(clubDiscoveryRelationshipSchema.parse(relationship)).toBe(relationship);
    },
  );

  it('exposes only Player-facing Club discovery fields', () => {
    expect(
      clubDiscoveryItemSchema.parse({
        id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
        name: 'Central Squash Club',
        timeZone: 'America/Costa_Rica',
        relationship: 'active',
        memberCount: 42,
        archivedAt: null,
        responsibilities: ['owner'],
      }),
    ).toEqual({
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      name: 'Central Squash Club',
      timeZone: 'America/Costa_Rica',
      relationship: 'active',
    });
  });

  it('supports bounded search pagination', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '10', search: ' central ' })).toEqual(
      {
        page: 2,
        pageSize: 10,
        search: 'central',
      },
    );
  });

  it('exposes an authenticated Player relationship and own pending request ID on the profile', () => {
    expect(
      clubProfileDetailSchema.parse({
        id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
        name: 'Central Squash Club',
        logoUrl: null,
        description: null,
        physicalAddress: 'San José',
        mapLink: null,
        contactEmail: 'club@example.com',
        contactPhone: null,
        timeZone: 'America/Costa_Rica',
        relationship: 'request-pending',
        pendingMembershipRequestId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
        pendingClubInvitationId: null,
        playerId: 'another-player',
      }),
    ).toEqual({
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      name: 'Central Squash Club',
      logoUrl: null,
      description: null,
      physicalAddress: 'San José',
      mapLink: null,
      contactEmail: 'club@example.com',
      contactPhone: null,
      timeZone: 'America/Costa_Rica',
      relationship: 'request-pending',
      pendingMembershipRequestId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
      pendingClubInvitationId: null,
    });
  });

  it('exposes only an eligible authenticated Player pending Club Invitation ID', () => {
    expect(
      clubProfileDetailSchema.parse({
        id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
        name: 'Central Squash Club',
        logoUrl: null,
        description: null,
        physicalAddress: 'San José',
        mapLink: null,
        contactEmail: 'club@example.com',
        contactPhone: null,
        timeZone: 'America/Costa_Rica',
        relationship: 'invited',
        pendingMembershipRequestId: null,
        pendingClubInvitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
        invitedEmail: 'player@example.com',
        token: 'secret',
      }),
    ).toEqual({
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      name: 'Central Squash Club',
      logoUrl: null,
      description: null,
      physicalAddress: 'San José',
      mapLink: null,
      contactEmail: 'club@example.com',
      contactPhone: null,
      timeZone: 'America/Costa_Rica',
      relationship: 'invited',
      pendingMembershipRequestId: null,
      pendingClubInvitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
    });
  });
});

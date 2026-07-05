import {
  clubDiscoveryItemSchema,
  clubDiscoveryRelationshipSchema,
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
});

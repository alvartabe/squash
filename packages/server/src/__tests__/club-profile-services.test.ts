import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { requireRegisteredPlayer } from '../authorization';
import { getPlayerFacingClubProfile } from '../club-profile';
import { db } from '../database';
import { forbidden } from '../errors';
import { createMediaDownloadUrl } from '../media';

jest.mock('../database', () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock('../authorization', () => ({
  requireRegisteredPlayer: jest.fn(),
}));

jest.mock('../media', () => ({
  createMediaDownloadUrl: jest.fn(),
  requireOwnedClubLogoAsset: jest.fn(),
}));

const mockDb = db as unknown as { select: jest.Mock };
const mockRequireRegisteredPlayer = requireRegisteredPlayer as jest.Mock;
const mockCreateMediaDownloadUrl = createMediaDownloadUrl as jest.Mock;
const dialect = new PgDialect();

function mockProfile(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result ? [result] : []);
  const where = jest.fn((_condition: unknown) => ({ limit }));
  const leftJoin = jest.fn(() => ({ where }));
  const from = jest.fn(() => ({ leftJoin }));
  mockDb.select.mockReturnValueOnce({ from });
  return { where };
}

describe('Player-facing Club Profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRegisteredPlayer.mockResolvedValue({
      id: 'player-id',
      email: 'player@example.com',
    });
    mockCreateMediaDownloadUrl.mockResolvedValue('https://media.example/logo');
  });

  it('returns Player-facing fields and only the authenticated Player pending request ID', async () => {
    const builders = mockProfile({
      id: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
      name: 'Central Squash Club',
      logoObjectKey: 'owner/club-logo/logo.webp',
      description: 'Community squash in San José.',
      physicalAddress: 'Avenida Central, San José',
      mapLink: 'https://maps.example/central',
      contactEmail: 'hello@central.example',
      contactPhone: null,
      timeZone: null,
      membershipStatus: null,
      pendingMembershipRequestId: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      pendingClubInvitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
    });

    await expect(
      getPlayerFacingClubProfile('player-id', '2d44fd7a-eac8-4a72-84e8-b3b46812f606'),
    ).resolves.toEqual({
      id: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
      name: 'Central Squash Club',
      logoUrl: 'https://media.example/logo',
      description: 'Community squash in San José.',
      physicalAddress: 'Avenida Central, San José',
      mapLink: 'https://maps.example/central',
      contactEmail: 'hello@central.example',
      contactPhone: null,
      timeZone: null,
      relationship: 'request-pending',
      pendingMembershipRequestId: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      pendingClubInvitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
    });
    expect(mockCreateMediaDownloadUrl).toHaveBeenCalledWith('owner/club-logo/logo.webp');

    const condition = builders.where.mock.calls[0]?.[0] as SQL;
    expect(dialect.sqlToQuery(condition).sql).toContain('"clubs"."archived_at" is null');

    const selected = mockDb.select.mock.calls[0]?.[0] as Record<string, { sql?: SQL }>;
    expect(dialect.sqlToQuery(selected.pendingMembershipRequestId?.sql as SQL)).toMatchObject({
      sql: expect.stringContaining("mr.status = 'pending'"),
      params: ['player-id'],
    });
    expect(dialect.sqlToQuery(selected.pendingClubInvitationId?.sql as SQL)).toMatchObject({
      sql: expect.stringContaining('ci.expires_at > now()'),
      params: ['player@example.com'],
    });
    const pendingInvitationQuery = dialect.sqlToQuery(
      selected.pendingClubInvitationId?.sql as SQL,
    ).sql;
    expect(pendingInvitationQuery).toContain('ci.club_id = "clubs"."id"');
    expect(pendingInvitationQuery).toContain('ci.accepted_at is null');
    expect(pendingInvitationQuery).toContain('ci.revoked_at is null');
  });

  it('returns the eligible authenticated Player pending Club Invitation ID', async () => {
    mockProfile({
      id: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
      name: 'Central Squash Club',
      logoObjectKey: null,
      description: null,
      physicalAddress: 'Avenida Central, San José',
      mapLink: null,
      contactEmail: null,
      contactPhone: '2222-2222',
      timeZone: 'America/Costa_Rica',
      membershipStatus: null,
      pendingMembershipRequestId: null,
      pendingClubInvitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
    });

    await expect(
      getPlayerFacingClubProfile('player-id', '2d44fd7a-eac8-4a72-84e8-b3b46812f606'),
    ).resolves.toMatchObject({
      relationship: 'invited',
      pendingMembershipRequestId: null,
      pendingClubInvitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
    });
  });

  it('does not expose another Player request or invitation identifier', async () => {
    mockProfile({
      id: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
      name: 'Central Squash Club',
      logoObjectKey: null,
      description: null,
      physicalAddress: 'Avenida Central, San José',
      mapLink: null,
      contactEmail: null,
      contactPhone: '2222-2222',
      timeZone: 'America/Costa_Rica',
      membershipStatus: null,
      pendingMembershipRequestId: null,
      pendingClubInvitationId: null,
    });

    await expect(
      getPlayerFacingClubProfile('player-id', '2d44fd7a-eac8-4a72-84e8-b3b46812f606'),
    ).resolves.toMatchObject({
      relationship: 'none',
      pendingMembershipRequestId: null,
      pendingClubInvitationId: null,
    });
  });

  it('requires an authenticated registered Player before reading a profile', async () => {
    mockRequireRegisteredPlayer.mockRejectedValueOnce(forbidden());

    await expect(
      getPlayerFacingClubProfile('missing-player', '2d44fd7a-eac8-4a72-84e8-b3b46812f606'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('does not expose an archived Club through the Player-facing profile endpoint', async () => {
    mockProfile(null);

    await expect(
      getPlayerFacingClubProfile('player-id', '2d44fd7a-eac8-4a72-84e8-b3b46812f606'),
    ).rejects.toMatchObject({ code: 'CLUB_NOT_FOUND', status: 404 });
  });
});

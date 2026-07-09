import {
  createTournamentSchema,
  tournamentManagementSchema,
  tournamentPlayerSchema,
} from '@squash/contracts';

describe('Official Tournament contracts', () => {
  it('requires explicit visibility and has no registration-closing input', () => {
    const input = {
      clubId: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      name: 'Open',
      startsAt: '2026-08-01T09:00:00-06:00',
      timeZone: 'America/Costa_Rica',
      groupSize: 4,
      qualifiersPerGroup: 2,
      seedingMethod: 'manual',
      rules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
    };
    expect(createTournamentSchema.safeParse(input).success).toBe(false);
    expect(
      createTournamentSchema.parse({
        ...input,
        visibility: 'public',
        registrationClosesAt: '2026-07-30T18:00:00-06:00',
      }),
    ).not.toHaveProperty('registrationClosesAt');
    expect(
      createTournamentSchema.safeParse({
        ...input,
        visibility: 'public',
        rules: { ...input.rules, bestOf: 7 },
      }).success,
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({
        ...input,
        visibility: 'public',
        seedingMethod: 'ranking',
      }).success,
    ).toBe(false);
  });

  it('exposes only roster-required Player data', () => {
    expect(
      tournamentPlayerSchema.parse({
        id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
        clubId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
        clubName: 'Central',
        name: 'Official Open',
        visibility: 'public',
        status: 'registration',
        startsAt: '2026-08-01T15:00:00.000Z',
        timeZone: 'America/Costa_Rica',
        relationship: 'invited',
        entryRequestId: null,
        invitationId: 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35',
        playerEmail: 'private@example.com',
      }),
    ).not.toHaveProperty('playerEmail');
  });

  it('models Official participation without Social Tournament states', () => {
    const shape = tournamentManagementSchema.shape;
    expect(shape).toHaveProperty('participations');
    expect(JSON.stringify(shape)).not.toContain('social');
  });
});

import {
  createTournamentSchema,
  officialResultInputSchema,
  organizerTiebreakDecisionInputSchema,
  tournamentManagementSchema,
  tournamentPlayerDetailSchema,
  tournamentPlayerSchema,
} from '@squash/contracts';

describe('Official Tournament contracts', () => {
  it('requires explicit visibility and has no registration-closing input', () => {
    const input = {
      clubId: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      name: 'Open',
      description: 'Costa Rica championship event.',
      venue: 'Central Squash Club',
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
      createTournamentSchema.parse({
        ...input,
        visibility: 'public',
      }).wildcardQualifiers,
    ).toBe(0);
    expect(createTournamentSchema.parse({ ...input, visibility: 'public' })).toMatchObject({
      description: 'Costa Rica championship event.',
      venue: 'Central Squash Club',
    });
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

    expect(
      tournamentPlayerSchema.parse({
        id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
        clubId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
        clubName: 'Central',
        name: 'Official Open',
        visibility: 'club-only',
        status: 'completed',
        startsAt: '2026-08-01T15:00:00.000Z',
        timeZone: 'America/Costa_Rica',
        relationship: 'accepted',
        entryRequestId: null,
        invitationId: null,
      }).status,
    ).toBe('completed');
  });

  it('models Official participation without Social Tournament states', () => {
    const parsed = tournamentManagementSchema.parse({
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      clubId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
      name: 'Official Open',
      description: 'Costa Rica championship event.',
      venue: 'Central Squash Club',
      visibility: 'public',
      status: 'group-stage',
      startsAt: '2026-08-01T15:00:00.000Z',
      timeZone: 'America/Costa_Rica',
      groupSize: 4,
      qualifiersPerGroup: 2,
      wildcardQualifiers: 1,
      draftDrawGeneratedAt: '2026-08-01T14:00:00.000Z',
      entryRequests: [],
      invitations: [],
      participations: [],
      organizerTiebreakRequirement: null,
      groupFixtures: [
        {
          id: '4cb49f8a-a584-4424-9e39-274df6d7f8d7',
          matchId: '71ba8d8f-c323-4e64-ae4f-7b6bb969f32c',
          stage: 'group',
          matchStatus: 'scheduled',
          currentRevision: 0,
          groupId: 'd7e5d16a-ee4f-4c57-b94f-eaf94ad2975d',
          groupName: 'A',
          groupPosition: 1,
          round: 1,
          position: 1,
          playerOne: {
            id: 'player-1',
            name: 'Ana Vega',
            image: 'https://example.test/ana.png',
          },
          playerTwo: { id: 'player-2', name: 'Bruno Castro', image: null },
          scoringRules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
          games: [],
          winnerId: null,
          mayRecordInitialOfficialResult: true,
          officialResultCorrectionStatus: 'unlocked',
        },
      ],
      knockoutFixtures: [],
    });
    const shape = tournamentManagementSchema.shape;
    expect(shape).toHaveProperty('participations');
    expect(shape).toHaveProperty('groupFixtures');
    expect(parsed.groupFixtures[0]?.winnerId).toBeNull();
    expect(parsed.groupFixtures[0]?.mayRecordInitialOfficialResult).toBe(true);
    expect(parsed.groupFixtures[0]?.matchStatus).toBe('scheduled');
    expect(parsed.groupFixtures[0]?.playerOne.name).toBe('Ana Vega');
    expect(parsed.groupFixtures[0]?.playerOne.image).toBe('https://example.test/ana.png');
    expect(JSON.stringify(shape)).not.toContain('social');
  });

  it('exposes a read-only Player detail projection without management or audit controls', () => {
    const parsed = tournamentPlayerDetailSchema.parse({
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      club: { id: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c', name: 'Central' },
      name: 'Official Open',
      description: 'Costa Rica championship event.',
      venue: 'Central Squash Club',
      visibility: 'public',
      status: 'completed',
      startsAt: '2026-08-01T15:00:00.000Z',
      timeZone: 'America/Costa_Rica',
      configuration: {
        groupSize: 4,
        automaticQualifiersPerGroup: 2,
        wildcardQualifiers: 1,
        seedingMethod: 'manual',
        scoringRules: { bestOf: 5, pointsToWin: 11, winByTwo: true },
      },
      groups: [
        {
          id: 'd7e5d16a-ee4f-4c57-b94f-eaf94ad2975d',
          name: 'A',
          position: 1,
          assignments: [
            { id: 'player-1', name: 'Ana Vega', image: null },
            { id: 'player-2', name: 'Bruno Castro', image: null },
          ],
          standings: [
            {
              rank: 1,
              tied: false,
              player: { id: 'player-1', name: 'Ana Vega', image: null },
              played: 1,
              wins: 1,
              losses: 0,
              gamesWon: 3,
              gamesLost: 1,
              gameDifferential: 2,
              pointsFor: 43,
              pointsAgainst: 35,
              pointDifferential: 8,
            },
          ],
          fixtures: [],
        },
      ],
      knockoutDraw: [
        {
          id: '4cb49f8a-a584-4424-9e39-274df6d7f8d7',
          matchId: '71ba8d8f-c323-4e64-ae4f-7b6bb969f32c',
          status: 'completed',
          round: 1,
          position: 1,
          scheduledAt: '2026-08-02T15:00:00.000Z',
          venueText: 'Glass Court',
          courtLabel: 'Court 1',
          playerOne: { id: 'player-1', name: 'Ana Vega', image: null },
          playerTwo: { id: 'player-2', name: 'Bruno Castro', image: null },
          games: [
            { playerOnePoints: 11, playerTwoPoints: 7 },
            { playerOnePoints: 11, playerTwoPoints: 8 },
            { playerOnePoints: 11, playerTwoPoints: 9 },
          ],
          winnerId: 'player-1',
        },
      ],
      champion: { id: 'player-1', name: 'Ana Vega', image: null },
    });

    expect(parsed.champion?.name).toBe('Ana Vega');
    expect(parsed.description).toBe('Costa Rica championship event.');
    expect(parsed.knockoutDraw[0]).toMatchObject({
      venueText: 'Glass Court',
      courtLabel: 'Court 1',
    });
    expect(parsed.groups[0]?.standings[0]?.gamesWon).toBe(3);
    expect(JSON.stringify(parsed)).not.toMatch(
      /currentRevision|correction|reason|audit|mayBegin|mayRecord|manage/i,
    );
  });

  it('structurally carries a null champion for a Cancelled Tournament', () => {
    const base = {
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      club: { id: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c', name: 'Central' },
      name: 'Official Open',
      description: null,
      venue: null,
      visibility: 'club-only',
      status: 'cancelled',
      startsAt: '2026-08-01T15:00:00.000Z',
      timeZone: 'America/Costa_Rica',
      configuration: {
        groupSize: 4,
        automaticQualifiersPerGroup: 2,
        wildcardQualifiers: 0,
        seedingMethod: 'random',
        scoringRules: { bestOf: 3, pointsToWin: 11, winByTwo: true },
      },
      groups: [],
      knockoutDraw: [],
    } as const;

    expect(tournamentPlayerDetailSchema.safeParse({ ...base, champion: null }).success).toBe(true);
  });

  it('leaves champion lifecycle enforcement to the domain and server', () => {
    const completedWithoutChampion = {
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      club: { id: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c', name: 'Central' },
      name: 'Official Open',
      description: null,
      venue: null,
      visibility: 'public',
      status: 'completed',
      startsAt: '2026-08-01T15:00:00.000Z',
      timeZone: 'America/Costa_Rica',
      configuration: {
        groupSize: 4,
        automaticQualifiersPerGroup: 2,
        wildcardQualifiers: 0,
        seedingMethod: 'random',
        scoringRules: { bestOf: 3, pointsToWin: 11, winByTwo: true },
      },
      groups: [],
      knockoutDraw: [],
      champion: null,
    } as const;

    expect(tournamentPlayerDetailSchema.safeParse(completedWithoutChampion).success).toBe(true);
  });

  it('requires a reason for corrections and rejects malformed Official Result Games', () => {
    expect(
      officialResultInputSchema.parse({
        expectedRevision: 0,
        games: [{ playerOnePoints: 11, playerTwoPoints: 7 }],
      }),
    ).toEqual({
      expectedRevision: 0,
      games: [{ playerOnePoints: 11, playerTwoPoints: 7 }],
    });
    expect(
      officialResultInputSchema.safeParse({
        expectedRevision: 1,
        games: [{ playerOnePoints: 11, playerTwoPoints: 7 }],
      }).success,
    ).toBe(false);
    expect(
      officialResultInputSchema.parse({
        expectedRevision: 1,
        reason: 'Corrected score sheet',
        games: [{ playerOnePoints: 11, playerTwoPoints: 7 }],
      }),
    ).toMatchObject({ expectedRevision: 1, reason: 'Corrected score sheet' });
    expect(
      officialResultInputSchema.safeParse({
        expectedRevision: 1,
        reason: 'Correction',
        games: [{ playerOnePoints: 11.5, playerTwoPoints: -1 }],
      }).success,
    ).toBe(false);
  });

  it('accepts only a unique, complete ordering for an exposed tie requirement', () => {
    const input = {
      requirementKey: 'a'.repeat(64),
      orderedPlayerIds: ['player-2', 'player-1'],
    };
    expect(organizerTiebreakDecisionInputSchema.parse(input)).toEqual(input);
    expect(
      organizerTiebreakDecisionInputSchema.safeParse({
        ...input,
        orderedPlayerIds: ['player-1', 'player-1'],
      }).success,
    ).toBe(false);
    expect(
      organizerTiebreakDecisionInputSchema.safeParse({
        ...input,
        orderedPlayerIds: ['player-1'],
      }).success,
    ).toBe(false);
  });
});

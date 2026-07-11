import { db } from '../database';
import { getOfficialTournamentPlayerDetail } from '../player-tournaments';
import { requireRegisteredPlayer } from '../authorization';

jest.mock('../database', () => ({ db: { select: jest.fn() } }));
jest.mock('../authorization', () => ({ requireRegisteredPlayer: jest.fn() }));

const mockDb = db as unknown as { select: jest.Mock };
const mockRequireRegisteredPlayer = requireRegisteredPlayer as jest.Mock;

function selectRows(rows: unknown[]) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
  };
  return query;
}

const tournament = {
  id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
  clubId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
  clubName: 'Central',
  name: 'Official Open',
  visibility: 'club-only' as const,
  status: 'group-stage' as const,
  startsAt: new Date('2026-08-01T15:00:00.000Z'),
  timeZone: 'America/Costa_Rica',
  groupSize: 4,
  qualifiersPerGroup: 2,
  wildcardQualifiers: 1,
  seedingMethod: 'manual' as const,
  rulesId: 'rules-id',
  bestOf: 3,
  pointsToWin: 11,
  winByTwo: true,
  hasActiveMembership: false,
  hasParticipation: false,
  hasPendingInvitation: false,
  hasPendingEntryRequest: false,
};

describe('Official Tournament Player detail authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRegisteredPlayer.mockResolvedValue({ id: 'player-id' });
  });

  it('rejects a registered Player without Club-only access', async () => {
    mockDb.select.mockReturnValueOnce(selectRows([tournament]));

    await expect(
      getOfficialTournamentPlayerDetail('player-id', tournament.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('does not extend Club-only progress access through a stale pre-Start request or invitation', async () => {
    mockDb.select.mockReturnValueOnce(
      selectRows([
        {
          ...tournament,
          hasPendingInvitation: true,
          hasPendingEntryRequest: true,
        },
      ]),
    );

    await expect(
      getOfficialTournamentPlayerDetail('player-id', tournament.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('retains Club-only access through accepted Tournament Participation after Membership changes', async () => {
    mockDb.select.mockReturnValueOnce(selectRows([{ ...tournament, hasParticipation: true }]));
    mockDb.select.mockReturnValueOnce(selectRows([]));
    mockDb.select.mockReturnValueOnce(selectRows([{ bestOf: 3, pointsToWin: 11, winByTwo: true }]));
    mockDb.select.mockReturnValueOnce(selectRows([]));

    await expect(
      getOfficialTournamentPlayerDetail('player-id', tournament.id),
    ).resolves.toMatchObject({ id: tournament.id, status: 'group-stage' });
  });

  it('allows an active member of the owning Club to view a Club-only Tournament', async () => {
    mockDb.select.mockReturnValueOnce(selectRows([{ ...tournament, hasActiveMembership: true }]));
    mockDb.select.mockReturnValueOnce(selectRows([]));
    mockDb.select.mockReturnValueOnce(selectRows([{ bestOf: 3, pointsToWin: 11, winByTwo: true }]));
    mockDb.select.mockReturnValueOnce(selectRows([]));

    await expect(
      getOfficialTournamentPlayerDetail('player-id', tournament.id),
    ).resolves.toMatchObject({ id: tournament.id, visibility: 'club-only' });
  });

  it('allows every registered Player to view a Public Tournament', async () => {
    mockDb.select.mockReturnValueOnce(
      selectRows([{ ...tournament, visibility: 'public', status: 'cancelled' }]),
    );
    mockDb.select.mockReturnValueOnce(selectRows([]));
    mockDb.select.mockReturnValueOnce(selectRows([{ bestOf: 3, pointsToWin: 11, winByTwo: true }]));
    mockDb.select.mockReturnValueOnce(selectRows([]));
    mockDb.select.mockReturnValueOnce(selectRows([]));

    await expect(
      getOfficialTournamentPlayerDetail('player-id', tournament.id),
    ).resolves.toMatchObject({ status: 'cancelled', champion: null });
  });

  it('does not expose a pre-Start Draft Draw to Players during Registration Open', async () => {
    mockDb.select.mockReturnValueOnce(
      selectRows([{ ...tournament, visibility: 'public', status: 'registration' }]),
    );
    mockDb.select.mockReturnValueOnce(
      selectRows([
        {
          groupId: 'd7e5d16a-ee4f-4c57-b94f-eaf94ad2975d',
          groupName: 'Draft A',
          groupPosition: 1,
          id: 'player-1',
          name: 'Ana Vega',
          image: null,
          seed: 1,
          finalRank: null,
        },
      ]),
    );
    mockDb.select.mockReturnValueOnce(selectRows([{ bestOf: 3, pointsToWin: 11, winByTwo: true }]));

    await expect(
      getOfficialTournamentPlayerDetail('player-id', tournament.id),
    ).resolves.toMatchObject({ status: 'registration', groups: [], knockoutDraw: [] });
  });

  it('projects canonical Group standings, finalized Game scores, and the champion without controls', async () => {
    const groupId = 'd7e5d16a-ee4f-4c57-b94f-eaf94ad2975d';
    const groupMatchId = '71ba8d8f-c323-4e64-ae4f-7b6bb969f32c';
    const knockoutMatchId = '82cb9e90-d434-4f75-bf70-8c7cca70a43d';
    mockDb.select.mockReturnValueOnce(
      selectRows([{ ...tournament, visibility: 'public', status: 'completed' }]),
    );
    mockDb.select.mockReturnValueOnce(
      selectRows([
        {
          groupId,
          groupName: 'A',
          groupPosition: 1,
          id: 'player-1',
          name: 'Ana Vega',
          image: null,
          seed: 1,
          finalRank: 1,
        },
        {
          groupId,
          groupName: 'A',
          groupPosition: 1,
          id: 'player-2',
          name: 'Bruno Castro',
          image: null,
          seed: 2,
          finalRank: 2,
        },
      ]),
    );
    mockDb.select.mockReturnValueOnce(selectRows([{ bestOf: 3, pointsToWin: 11, winByTwo: true }]));
    mockDb.select.mockReturnValueOnce(
      selectRows([
        {
          id: '4cb49f8a-a584-4424-9e39-274df6d7f8d7',
          matchId: groupMatchId,
          matchStatus: 'completed',
          currentRevision: 1,
          winnerId: 'player-1',
          groupId,
          groupName: 'A',
          groupPosition: 1,
          round: 1,
          position: 1,
          playerOneId: 'player-1',
          playerOneName: 'Ana Vega',
          playerOneImage: null,
          playerTwoId: 'player-2',
          playerTwoName: 'Bruno Castro',
          playerTwoImage: null,
          bestOf: 3,
          pointsToWin: 11,
          winByTwo: true,
        },
      ]),
    );
    mockDb.select.mockReturnValueOnce(
      selectRows([
        {
          id: '5dc5af9b-b695-4535-afc0-385e07e8f9e8',
          matchId: knockoutMatchId,
          matchStatus: 'completed',
          currentRevision: 1,
          winnerId: 'player-1',
          advancesToFixtureId: null,
          round: 1,
          position: 1,
          playerOneId: 'player-1',
          playerOneName: 'Ana Vega',
          playerOneImage: null,
          playerTwoId: 'player-2',
          playerTwoName: 'Bruno Castro',
          playerTwoImage: null,
        },
      ]),
    );
    mockDb.select.mockReturnValueOnce(
      selectRows([
        { matchId: groupMatchId, playerOnePoints: 11, playerTwoPoints: 7 },
        { matchId: groupMatchId, playerOnePoints: 11, playerTwoPoints: 8 },
        { matchId: knockoutMatchId, playerOnePoints: 11, playerTwoPoints: 9 },
        { matchId: groupMatchId, playerOnePoints: 8, playerTwoPoints: 11 },
        { matchId: knockoutMatchId, playerOnePoints: 11, playerTwoPoints: 6 },
      ]),
    );

    const detail = await getOfficialTournamentPlayerDetail('player-id', tournament.id);

    expect(detail.groups[0]?.standings).toEqual([
      expect.objectContaining({
        rank: 1,
        player: expect.objectContaining({ id: 'player-1' }),
        wins: 1,
        gamesWon: 2,
        gamesLost: 1,
      }),
      expect.objectContaining({
        rank: 2,
        player: expect.objectContaining({ id: 'player-2' }),
        losses: 1,
      }),
    ]);
    expect(detail.groups[0]?.fixtures[0]?.games).toHaveLength(3);
    expect(detail.knockoutDraw[0]?.games).toHaveLength(2);
    expect(detail.champion).toEqual({ id: 'player-1', name: 'Ana Vega', image: null });
    expect(JSON.stringify(detail)).not.toMatch(
      /revision|correction|reason|audit|mayBegin|mayRecord/i,
    );
  });

  it('requires an authenticated registered Player before loading the Tournament', async () => {
    mockRequireRegisteredPlayer.mockRejectedValueOnce({ code: 'FORBIDDEN', status: 403 });

    await expect(
      getOfficialTournamentPlayerDetail('missing-player', tournament.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

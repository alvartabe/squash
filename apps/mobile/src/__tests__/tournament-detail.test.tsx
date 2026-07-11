import type { TournamentPlayerDetail } from '@squash/contracts';
import { render } from '@testing-library/react-native';
import { TournamentDetail } from '@/src/components/tournament-detail';
import { t } from '@/src/lib/i18n';

const playerOne = { id: 'player-1', name: 'Ana Vega', image: null };
const playerTwo = { id: 'player-2', name: 'Bruno Castro', image: null };

const detail: TournamentPlayerDetail = {
  id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
  club: { id: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c', name: 'Central' },
  name: 'Official Open',
  description: 'Costa Rica championship event.',
  venue: 'Central Squash Club',
  visibility: 'public',
  status: 'completed',
  startsAt: '2026-08-01T15:00:00.000Z',
  timeZone: 'Pacific/Honolulu',
  configuration: {
    groupSize: 4,
    automaticQualifiersPerGroup: 2,
    wildcardQualifiers: 1,
    seedingMethod: 'manual',
    scoringRules: { bestOf: 3, pointsToWin: 11, winByTwo: true },
  },
  groups: [
    {
      id: 'd7e5d16a-ee4f-4c57-b94f-eaf94ad2975d',
      name: 'A',
      position: 1,
      assignments: [playerOne, playerTwo],
      standings: [
        {
          rank: 1,
          tied: false,
          player: playerOne,
          played: 1,
          wins: 1,
          losses: 0,
          gamesWon: 2,
          gamesLost: 0,
          gameDifferential: 2,
          pointsFor: 22,
          pointsAgainst: 14,
          pointDifferential: 8,
        },
      ],
      fixtures: [
        {
          id: '4cb49f8a-a584-4424-9e39-274df6d7f8d7',
          matchId: '71ba8d8f-c323-4e64-ae4f-7b6bb969f32c',
          status: 'completed',
          round: 1,
          position: 1,
          venueText: 'Glass Court',
          courtLabel: 'Court 1',
          playerOne,
          playerTwo,
          games: [
            { playerOnePoints: 11, playerTwoPoints: 7 },
            { playerOnePoints: 11, playerTwoPoints: 7 },
          ],
          winnerId: 'player-1',
        },
      ],
    },
  ],
  knockoutDraw: [
    {
      id: '5dc5af9b-b695-4535-afc0-385e07e8f9e8',
      matchId: '82cb9e90-d434-4f75-bf70-8c7cca70a43d',
      status: 'completed',
      round: 1,
      position: 1,
      scheduledAt: '2026-08-02T01:00:00.000Z',
      playerOne,
      playerTwo,
      games: [
        { playerOnePoints: 11, playerTwoPoints: 9 },
        { playerOnePoints: 11, playerTwoPoints: 6 },
      ],
      winnerId: 'player-1',
    },
  ],
  champion: playerOne,
};

describe('Official Tournament Player detail', () => {
  it('shows identity, configuration, Groups, standings, Game scores, Knockout Draw, and champion', () => {
    const screen = render(<TournamentDetail tournament={detail} />);

    expect(screen.getByText('Official Open')).toBeTruthy();
    expect(screen.getByText('Central')).toBeTruthy();
    expect(screen.getByText('Costa Rica championship event.')).toBeTruthy();
    expect(screen.getByText('Central Squash Club')).toBeTruthy();
    expect(screen.getAllByText(t('tournaments.status.completed')).length).toBeGreaterThan(0);
    expect(screen.getByText(t('tournaments.detail.configuration'))).toBeTruthy();
    expect(screen.getByText(`${t('tournaments.group')} A`)).toBeTruthy();
    expect(screen.getByText(t('tournaments.detail.standings'))).toBeTruthy();
    expect(screen.getAllByText('11–7')).toHaveLength(2);
    expect(screen.getByText(t('tournaments.detail.knockoutDraw'))).toBeTruthy();
    expect(screen.getByText('Glass Court · Court 1')).toBeTruthy();
    expect(screen.getByText(/Aug 1, 2026.*3:00 PM/)).toBeTruthy();
    expect(screen.getByText(`${t('tournaments.detail.champion')}: Ana Vega`)).toBeTruthy();
  });

  it('shows scheduled and in-progress Knockout Matches without management actions', () => {
    const screen = render(
      <TournamentDetail
        tournament={{
          ...detail,
          status: 'knockout',
          champion: null,
          knockoutDraw: [
            { ...detail.knockoutDraw[0]!, status: 'scheduled', games: [], winnerId: null },
            {
              ...detail.knockoutDraw[0]!,
              id: '6ed6b0ac-c7a6-4646-9d20-496f18f901ab',
              status: 'in-progress',
              games: [],
              winnerId: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(t('tournaments.matchStatus.scheduled'))).toBeTruthy();
    expect(screen.getByText(t('tournaments.matchStatus.inProgress'))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(t('tournaments.startTournament'))).toBeNull();
    expect(screen.queryByText(t('tournaments.officialResult.correct'))).toBeNull();
  });

  it('shows cancellation without declaring a champion', () => {
    const screen = render(
      <TournamentDetail tournament={{ ...detail, status: 'cancelled', champion: null }} />,
    );

    expect(screen.getByText(t('tournaments.detail.cancelledNoChampion'))).toBeTruthy();
    expect(screen.queryByText(`${t('tournaments.detail.champion')}: Ana Vega`)).toBeNull();
  });
});

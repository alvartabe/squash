import { fireEvent, render, screen } from '@testing-library/react';
import type { TournamentGroupFixture } from '@squash/contracts';
import { translate, type Locale } from '@squash/i18n';
import { FixtureOfficialResult } from './tournaments-page';

const mutate = jest.fn();
let actionState: {
  mutate: typeof mutate;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
} = { mutate, isPending: false, isError: false };
let locale: Locale = 'en-US';

jest.mock('@/src/hooks/workspace', () => ({
  useTournamentAction: () => actionState,
}));

jest.mock('@/src/locale-provider', () => ({
  useLocale: () => ({ t: (key: Parameters<typeof translate>[1]) => translate(locale, key) }),
}));

const fixture: TournamentGroupFixture = {
  id: 'fixture-id',
  matchId: 'match-id',
  stage: 'group',
  matchStatus: 'scheduled',
  currentRevision: 0,
  groupId: 'group-id',
  groupName: 'A',
  groupPosition: 1,
  round: 1,
  position: 1,
  playerOne: { id: 'player-1', name: 'Ana Vega', image: null },
  playerTwo: { id: 'player-2', name: 'Bruno Castro', image: null },
  scoringRules: { bestOf: 3, pointsToWin: 11, winByTwo: true },
  games: [],
  winnerId: null,
  mayRecordInitialOfficialResult: true,
};

function renderEntry(value: TournamentGroupFixture = fixture) {
  return render(
    <FixtureOfficialResult clubId="club-id" fixture={value} tournamentId="tournament-id" />,
  );
}

describe('Official Result score entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    actionState = { mutate, isPending: false, isError: false };
    locale = 'en-US';
  });

  it('renders one accessible row per configured Game and explicitly finalizes valid scores', () => {
    renderEntry();
    expect(screen.getAllByText(/^Game [1-3]$/)).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Ana Vega Game 1'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Bruno Castro Game 1'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Ana Vega Game 2'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Bruno Castro Game 2'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Official Result' }));

    expect(mutate).toHaveBeenCalledWith({
      path: '/tournaments/tournament-id/fixtures/fixture-id/official-result',
      data: {
        expectedRevision: 0,
        games: [
          { playerOnePoints: 11, playerTwoPoints: 7 },
          { playerOnePoints: 12, playerTwoPoints: 10 },
        ],
      },
    });
  });

  it('keeps server validation and catches obvious incomplete or tied input before submission', () => {
    renderEntry();
    fireEvent.change(screen.getByLabelText('Ana Vega Game 1'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Bruno Castro Game 1'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Official Result' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter consecutive, complete Games with valid scores and one Match winner.',
    );
  });

  it('disables duplicate submission while pending and gives actionable server-error feedback', () => {
    actionState = {
      mutate,
      isPending: true,
      isError: true,
      error: { response: { data: { error: { code: 'OFFICIAL_RESULT_CONFLICT' } } } },
    };
    renderEntry();
    expect(screen.getByRole('button', { name: 'Finalizing…' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Another Organizer changed this Match');
  });

  it('renders completed Game scores and the winner', () => {
    renderEntry({
      ...fixture,
      matchStatus: 'completed',
      currentRevision: 1,
      games: [
        { playerOnePoints: 11, playerTwoPoints: 7 },
        { playerOnePoints: 11, playerTwoPoints: 9 },
      ],
      winnerId: 'player-1',
      mayRecordInitialOfficialResult: false,
    });
    expect(screen.getByText('11–7, 11–9')).toBeInTheDocument();
    expect(screen.getByText('Winner: Ana Vega')).toBeInTheDocument();
  });

  it('renders complete Costa Rican Spanish score-entry translations', () => {
    locale = 'es-419';
    renderEntry();
    expect(screen.getAllByText(/^Juego [1-3]$/)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Finalizar Resultado Oficial' })).toBeInTheDocument();
  });
});

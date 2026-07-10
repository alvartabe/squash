import { fireEvent, render, screen } from '@testing-library/react';
import type { OrganizerTiebreakRequirement } from '@squash/contracts';
import { OrganizerTiebreakDecisionSection } from './tournaments-page';

const mutate = jest.fn();

jest.mock('@/src/hooks/workspace', () => ({
  useTournamentAction: () => ({ mutate, isPending: false, isError: false }),
}));

jest.mock('@/src/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const requirement: OrganizerTiebreakRequirement = {
  context: 'group-standings',
  group: { id: 'group-id', name: 'A' },
  players: [
    { id: 'player-1', name: 'Ana Vega', image: null },
    { id: 'player-2', name: 'Bruno Castro', image: null },
    { id: 'player-3', name: 'Camila Solano', image: null },
  ],
  requirementKey: 'a'.repeat(64),
};

describe('Organizer Tiebreak Decision interface', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the tie context, lets the organizer order every tied Player, and submits it', () => {
    render(
      <OrganizerTiebreakDecisionSection
        clubId="club-id"
        requirement={requirement}
        tournamentId="tournament-id"
      />,
    );

    expect(screen.getByText('tournaments.tiebreak.groupStandings')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getAllByTestId('tiebreak-player').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Ana Vega'),
      expect.stringContaining('Bruno Castro'),
      expect.stringContaining('Camila Solano'),
    ]);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'tournaments.tiebreak.moveUp Camila Solano',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'tournaments.tiebreak.submit' }));

    expect(mutate).toHaveBeenCalledWith({
      path: '/tournaments/tournament-id/organizer-tiebreak-decision',
      data: {
        requirementKey: requirement.requirementKey,
        orderedPlayerIds: ['player-1', 'player-3', 'player-2'],
      },
    });
  });
});

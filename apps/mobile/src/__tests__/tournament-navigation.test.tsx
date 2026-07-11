import type { TournamentPlayer } from '@squash/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
import { TournamentCard } from '../../app/(tabs)/tournaments';
import { t } from '@/src/lib/i18n';

jest.mock('@/src/lib/api', () => ({
  api: {
    requestTournamentEntry: jest.fn(),
    acceptTournamentInvitation: jest.fn(),
    rejectTournamentInvitation: jest.fn(),
    withdrawTournamentParticipation: jest.fn(),
  },
}));
jest.mock('@/src/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

describe('Tournament list navigation', () => {
  it('opens progress detail for a completed Official Tournament without registration actions', () => {
    const onOpen = jest.fn();
    const tournament: TournamentPlayer = {
      id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
      clubId: '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c',
      clubName: 'Central',
      name: 'Official Open',
      visibility: 'public',
      status: 'completed',
      startsAt: '2026-08-01T15:00:00.000Z',
      timeZone: 'America/Costa_Rica',
      relationship: 'accepted',
      entryRequestId: null,
      invitationId: null,
    };
    const screen = render(
      <QueryClientProvider client={new QueryClient()}>
        <TournamentCard onOpen={onOpen} tournament={tournament} />
      </QueryClientProvider>,
    );

    fireEvent.press(screen.getByText(t('tournaments.openDetail')));
    expect(onOpen).toHaveBeenCalledWith(tournament.id);
    expect(screen.queryByText(t('tournaments.withdraw'))).toBeNull();
    expect(screen.queryByText(t('tournaments.requestEntry'))).toBeNull();
  });
});

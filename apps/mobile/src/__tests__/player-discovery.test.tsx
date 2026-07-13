import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PlayerDiscoveryScreen from '../../app/player-discovery';
import { api } from '@/src/lib/api';
import { t } from '@/src/lib/i18n';

jest.mock('@/src/lib/api', () => ({ api: { findPlayerByUsername: jest.fn() } }));

const mockFindPlayer = api.findPlayerByUsername as jest.Mock;

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <PlayerDiscoveryScreen />
    </QueryClientProvider>,
  );
}

describe('Player Username discovery screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows only the minimal exact-match projection', async () => {
    mockFindPlayer.mockResolvedValueOnce({
      data: { username: 'Maria.Solis', displayName: 'María Solís', avatar: null },
    });
    const screen = renderScreen();

    fireEvent.changeText(screen.getByLabelText(t('profile.username')), 'Maria.Solis');
    fireEvent.press(screen.getByText(t('discovery.search')));

    await waitFor(() => expect(mockFindPlayer).toHaveBeenCalledWith('Maria.Solis'));
    expect(screen.getByText('María Solís')).toBeTruthy();
    expect(screen.getByText('Maria.Solis')).toBeTruthy();
  });

  it('shows a no-match state', async () => {
    mockFindPlayer.mockResolvedValueOnce({ data: null });
    const screen = renderScreen();
    fireEvent.changeText(screen.getByLabelText(t('profile.username')), 'missing');
    fireEvent.press(screen.getByText(t('discovery.search')));
    await waitFor(() => expect(screen.getByText(t('discovery.noMatch'))).toBeTruthy());
  });

  it('does not search for an invalid Username', () => {
    const screen = renderScreen();
    fireEvent.changeText(screen.getByLabelText(t('profile.username')), 'ab');
    fireEvent.press(screen.getByText(t('discovery.search')));
    expect(screen.getByText(t('profile.usernameInvalid'))).toBeTruthy();
    expect(mockFindPlayer).not.toHaveBeenCalled();
  });
});

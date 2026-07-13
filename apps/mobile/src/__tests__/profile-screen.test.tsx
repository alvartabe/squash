import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../../app/(tabs)/profile';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

jest.mock('@/src/lib/api', () => ({
  api: { getProfile: jest.fn(), updateProfile: jest.fn() },
}));
jest.mock('@/src/lib/auth-client', () => ({
  authClient: { useSession: jest.fn(), signOut: jest.fn() },
}));

const profile = {
  name: 'María Solís',
  bio: 'Squash player',
  dominantHand: 'right' as const,
  visibility: 'shared-clubs' as const,
  locale: 'es-419' as const,
  timeZone: 'America/Costa_Rica',
};

const mockGetProfile = api.getProfile as jest.Mock;
const mockUpdateProfile = api.updateProfile as jest.Mock;
const mockUseSession = authClient.useSession as jest.Mock;

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

describe('Player Profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: { user: { id: 'player-id', email: 'maria@example.com' } },
      isPending: false,
    });
    mockGetProfile.mockResolvedValue({ data: profile });
  });

  it('loads the authenticated Player profile and saves permitted Profile details', async () => {
    mockUpdateProfile.mockResolvedValue({
      data: { ...profile, name: 'María Fernanda Solís', visibility: 'private' },
    });
    const screen = renderScreen();

    await waitFor(() => expect(screen.getByDisplayValue(profile.name)).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText(t('profile.displayName')), 'María Fernanda Solís');
    fireEvent.changeText(screen.getByLabelText(t('profile.biography')), 'Club competitor');
    fireEvent.press(screen.getByText(t('profile.leftHanded')));
    fireEvent.press(screen.getByText(t('profile.visibilityPrivate')));
    fireEvent.press(screen.getByText(t('profile.save')));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: 'María Fernanda Solís',
        bio: 'Club competitor',
        dominantHand: 'left',
        visibility: 'private',
        locale: 'es-419',
        timeZone: 'America/Costa_Rica',
      }),
    );
    expect(screen.getByText(t('profile.saved'))).toBeTruthy();
  });

  it('does not save an empty display name', async () => {
    const screen = renderScreen();

    await waitFor(() => expect(screen.getByDisplayValue(profile.name)).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText(t('profile.displayName')), '   ');
    fireEvent.press(screen.getByText(t('profile.save')));

    expect(screen.getByText(t('profile.nameRequired'))).toBeTruthy();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('requires an explicit visibility choice before the first save', async () => {
    mockGetProfile.mockResolvedValueOnce({ data: { ...profile, visibility: null } });
    const screen = renderScreen();

    await waitFor(() => expect(screen.getByDisplayValue(profile.name)).toBeTruthy());
    fireEvent.press(screen.getByText(t('profile.save')));

    expect(screen.getByText(t('profile.visibilityRequired'))).toBeTruthy();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});

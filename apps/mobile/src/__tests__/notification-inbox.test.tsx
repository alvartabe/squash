import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { InAppNotification } from '@squash/contracts';
import NotificationInboxScreen from '../../app/notifications';
import ClubPlaySessionDetailScreen from '../../app/club-play-sessions/[sessionId]';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';
import { translate } from '@squash/i18n';

const mockRouter = { back: jest.fn(), push: jest.fn() };

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ sessionId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606' }),
  useRouter: () => mockRouter,
}));
jest.mock('@/src/lib/api', () => ({
  api: {
    getInAppNotifications: jest.fn(),
    getProfile: jest.fn(),
    markInAppNotificationRead: jest.fn(),
    getClubPlaySession: jest.fn(),
    setClubPlaySessionAttendance: jest.fn(),
  },
}));
jest.mock('@/src/lib/auth-client', () => ({
  authClient: { useSession: jest.fn() },
}));

const mockGetInAppNotifications = api.getInAppNotifications as jest.Mock;
const mockGetProfile = api.getProfile as jest.Mock;
const mockMarkInAppNotificationRead = api.markInAppNotificationRead as jest.Mock;
const mockGetClubPlaySession = api.getClubPlaySession as jest.Mock;
const mockUseSession = authClient.useSession as jest.Mock;
const unreadNotification = {
  id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
  type: 'club-play-session.invited' as const,
  clubPlaySessionId: '2d44fd7a-eac8-4a72-84e8-b3b46812f606',
  readAt: null,
  createdAt: '2026-07-12T15:00:00.000Z',
};
const readNotification = {
  ...unreadNotification,
  id: '6ed6b0ac-c7a6-4c64-9d20-496f18f901ab',
  readAt: '2026-07-12T16:00:00.000Z',
};

function renderScreen(screen: React.ReactElement) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}
    >
      {screen}
    </QueryClientProvider>,
  );
}

describe('in-app notification inbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: { user: { id: 'player-id' } }, isPending: false });
    mockGetProfile.mockResolvedValue({ data: { locale: 'es-419' } });
  });

  it('renders loading, read, and unread invitation states, then marks and opens the selected Session', async () => {
    let resolveNotifications: (value: { data: InAppNotification[] }) => void;
    mockGetInAppNotifications.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNotifications = resolve;
      }),
    );
    mockMarkInAppNotificationRead.mockResolvedValueOnce({
      data: { ...unreadNotification, readAt: readNotification.readAt },
    });
    const screen = renderScreen(<NotificationInboxScreen />);

    expect(screen.getByLabelText(t('common.loading'))).toBeTruthy();
    resolveNotifications!({ data: [unreadNotification, readNotification] });

    await waitFor(() =>
      expect(screen.getByText(translate('es-419', 'notifications.unread'))).toBeTruthy(),
    );
    expect(screen.getByText(translate('es-419', 'notifications.read'))).toBeTruthy();
    expect(
      screen.getAllByText(translate('es-419', 'notification.sessionInvited.title')),
    ).toHaveLength(2);
    fireEvent.press(screen.getByText(translate('es-419', 'notifications.unread')));

    await waitFor(() =>
      expect(mockMarkInAppNotificationRead).toHaveBeenCalledWith(unreadNotification.id),
    );
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith(
        `/club-play-sessions/${unreadNotification.clubPlaySessionId}`,
      ),
    );
  });

  it('renders localized empty and load failure states', async () => {
    mockGetInAppNotifications.mockResolvedValueOnce({ data: [] });
    const empty = renderScreen(<NotificationInboxScreen />);
    await waitFor(() =>
      expect(empty.getByText(translate('es-419', 'notifications.empty'))).toBeTruthy(),
    );
    empty.unmount();

    mockGetInAppNotifications.mockResolvedValue({ data: [] });
    mockGetProfile.mockRejectedValueOnce(new Error('offline'));
    mockGetProfile.mockResolvedValueOnce({ data: { locale: 'es-419' } });
    const failed = renderScreen(<NotificationInboxScreen />);
    await waitFor(() => expect(failed.getByText(t('notifications.loadError'))).toBeTruthy());
    fireEvent.press(failed.getByText(t('common.retry')));
    await waitFor(() =>
      expect(failed.getByText(translate('es-419', 'notifications.empty'))).toBeTruthy(),
    );
  });

  it('renders a localized Session destination failure state', async () => {
    mockGetClubPlaySession.mockRejectedValueOnce(new Error('not found'));
    const screen = renderScreen(<ClubPlaySessionDetailScreen />);

    await waitFor(() =>
      expect(screen.getByText(translate('es-419', 'sessions.detailLoadError'))).toBeTruthy(),
    );
  });
});

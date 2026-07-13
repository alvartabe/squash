import { profileSetupRedirect } from '@/src/lib/profile-setup-gate';

describe('initial Player Profile setup gate', () => {
  it('sends an authenticated Player without a Username to Profile setup', () => {
    expect(
      profileSetupRedirect({
        authenticated: true,
        profileLoaded: true,
        username: null,
        onSetupRoute: false,
      }),
    ).toBe('/profile-setup');
  });

  it('opens the app after Profile setup creates the Username', () => {
    expect(
      profileSetupRedirect({
        authenticated: true,
        profileLoaded: true,
        username: 'Maria.Solis',
        onSetupRoute: true,
      }),
    ).toBe('/(tabs)');
  });
});

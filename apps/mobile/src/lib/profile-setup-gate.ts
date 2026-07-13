export function profileSetupRedirect(input: {
  authenticated: boolean;
  profileLoaded: boolean;
  username: string | null;
  onSetupRoute: boolean;
}) {
  if (!input.authenticated || !input.profileLoaded) return null;
  if (input.username === null && !input.onSetupRoute) return '/profile-setup' as const;
  if (input.username !== null && input.onSetupRoute) return '/(tabs)' as const;
  return null;
}

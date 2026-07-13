import '../global.css';
import { QueryProvider } from '@/src/lib/query-provider';
import { queryKeys } from '@squash/api-client';
import { useQuery } from '@tanstack/react-query';
import { type Href, Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';
import { profileSetupRedirect } from '@/src/lib/profile-setup-gate';

export default function RootLayout() {
  return (
    <QueryProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </QueryProvider>
  );
}

function RootNavigator() {
  const session = authClient.useSession();
  const segments = useSegments();
  const playerId = session.data?.user.id;
  const profile = useQuery({
    queryKey: queryKeys.profile(playerId ?? 'signed-out'),
    queryFn: () => api.getProfile(),
    enabled: Boolean(playerId),
  });
  const redirect = profileSetupRedirect({
    authenticated: Boolean(playerId),
    profileLoaded: profile.isSuccess,
    username: profile.data?.data.username ?? null,
    onSetupRoute: (segments[0] as string | undefined) === 'profile-setup',
  });

  if (playerId && profile.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (playerId && profile.isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text accessibilityRole="alert">{t('profile.loadError')}</Text>
        <Pressable accessibilityRole="button" onPress={() => profile.refetch()}>
          <Text>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }
  if (redirect) return <Redirect href={redirect as Href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { type Href, router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Screen } from '@/src/components/screen';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

export default function ProfileScreen() {
  const session = authClient.useSession();
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>{t('profile.heading')}</Text>
      <Text>{session.data?.user.email}</Text>
      <Pressable onPress={() => router.push('/notification-preferences' as Href)}>
        <Text>{t('profile.notificationPreferences')}</Text>
      </Pressable>
      <Pressable onPress={() => authClient.signOut()}>
        <Text>{t('profile.signOut')}</Text>
      </Pressable>
    </Screen>
  );
}

import { Tabs } from 'expo-router';
import { House, Trophy, UserRound, UsersRound } from 'lucide-react-native';
import { colors } from '@squash/design-tokens';
import { t } from '@/src/lib/i18n';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.home'), tabBarIcon: ({ color }) => <House color={color} /> }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: t('nav.sessions'),
          tabBarIcon: ({ color }) => <UsersRound color={color} />,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: t('nav.tournaments'),
          tabBarIcon: ({ color }) => <Trophy color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color }) => <UserRound color={color} />,
        }}
      />
    </Tabs>
  );
}

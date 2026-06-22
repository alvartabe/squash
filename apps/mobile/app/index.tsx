import { authClient } from '@/src/lib/auth-client';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const session = authClient.useSession();
  if (session.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={session.data ? '/(tabs)' : '/(auth)/sign-in'} />;
}

import '../global.css';
import { QueryProvider } from '@/src/lib/query-provider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <QueryProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryProvider>
  );
}

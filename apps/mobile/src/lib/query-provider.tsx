import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Network from 'expo-network';
import type { PropsWithChildren } from 'react';

onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) =>
    setOnline(Boolean(state.isConnected)),
  );
  return () => subscription.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 1 },
    mutations: { retry: false, networkMode: 'online' },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'squash-query-cache' });

export function QueryProvider({ children }: PropsWithChildren) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

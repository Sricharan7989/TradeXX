import '../src/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSessionBootstrap } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth-store';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  useSessionBootstrap();
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-0">
        <ActivityIndicator color="#387ed1" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0e14' } }} />
    </QueryClientProvider>
  );
}

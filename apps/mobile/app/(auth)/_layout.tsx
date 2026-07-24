import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';

export default function AuthLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Redirect href="/(app)/watchlist" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b0e14' },
      }}
    />
  );
}

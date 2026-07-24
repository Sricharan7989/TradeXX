import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useMe } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth-store';

export default function AppLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: me, isLoading } = useMe();

  if (!accessToken) return <Redirect href="/(auth)/login" />;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-0">
        <ActivityIndicator color="#387ed1" />
      </View>
    );
  }

  if (me && me.profile?.kyc_status !== 'VERIFIED') {
    return <Redirect href="/kyc" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#11151d' },
        headerTintColor: '#e6e9ef',
        tabBarStyle: { backgroundColor: '#11151d', borderTopColor: '#262c38' },
        tabBarActiveTintColor: '#387ed1',
        tabBarInactiveTintColor: '#8b93a3',
      }}
    >
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio' }} />
      <Tabs.Screen name="funds" options={{ title: 'Funds' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

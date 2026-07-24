import { Redirect } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return <Redirect href={accessToken ? '/(app)/watchlist' : '/(auth)/login'} />;
}

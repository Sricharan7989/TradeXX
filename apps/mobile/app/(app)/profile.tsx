import { ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useMe, useLogout } from '@/hooks/use-auth';
import { useBiometric } from '@/hooks/use-biometric';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-surface-border py-3">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Text className="text-sm text-ink">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { data: me } = useMe();
  const logout = useLogout();
  const biometric = useBiometric();

  return (
    <ScrollView className="flex-1 bg-surface-0" contentContainerClassName="p-4">
      <View className="mb-6 rounded-lg border border-surface-border bg-surface-1 p-4">
        <Text className="mb-2 text-base font-semibold text-ink">Account</Text>
        <Row label="Email" value={me?.user.email ?? '—'} />
        <Row label="Phone" value={me?.user.phone ?? '—'} />
        <Row label="Trading mode" value={me?.settings.trading_mode ?? '—'} />
        <Row label="2FA" value={me?.user.is_2fa_enabled ? 'Enabled' : 'Disabled'} />
      </View>

      {biometric.available && (
        <View className="mb-6 flex-row items-center justify-between rounded-lg border border-surface-border bg-surface-1 p-4">
          <View>
            <Text className="text-sm font-medium text-ink">Biometric unlock</Text>
            <Text className="text-xs text-ink-faint">Use Face ID / fingerprint to open the app</Text>
          </View>
          <Switch value={biometric.enabled} onValueChange={biometric.toggle} />
        </View>
      )}

      <Button label="Log out" variant="secondary" onPress={() => logout.mutate()} loading={logout.isPending} />
    </ScrollView>
  );
}

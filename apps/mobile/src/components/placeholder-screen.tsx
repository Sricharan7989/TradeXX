import { Text, View } from 'react-native';

export function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-0 px-8">
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-sm text-ink-muted">{note ?? 'Coming in a later phase.'}</Text>
    </View>
  );
}

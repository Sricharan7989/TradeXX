import { Text, View } from 'react-native';

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View className="mb-4 rounded border border-loss/30 bg-loss-muted px-3 py-2">
      <Text className="text-sm text-loss">{message}</Text>
    </View>
  );
}

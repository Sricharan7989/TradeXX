import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, ...props }: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-medium text-ink-muted">{label}</Text>
      <TextInput
        placeholderTextColor="#5b6473"
        className="h-11 rounded border border-surface-border bg-surface-1 px-3 text-sm text-ink"
        {...props}
      />
    </View>
  );
}

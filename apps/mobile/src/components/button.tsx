import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ label, loading, variant = 'primary', disabled, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? 'bg-accent-500 active:bg-accent-600'
      : variant === 'secondary'
        ? 'bg-surface-2 border border-surface-border'
        : 'bg-transparent';
  const text = variant === 'ghost' ? 'text-ink-muted' : variant === 'secondary' ? 'text-ink' : 'text-white';

  return (
    <Pressable
      disabled={isDisabled}
      className={`h-11 items-center justify-center rounded ${bg} ${isDisabled ? 'opacity-50' : ''}`}
      {...props}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text className={`text-sm font-medium ${text}`}>{label}</Text>}
    </Pressable>
  );
}

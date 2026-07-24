import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/input';
import { api } from '@/lib/api-client';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');

  const mutation = useMutation({
    mutationFn: api.forgotPassword,
    onSuccess: () => {
      router.push({ pathname: '/(auth)/reset-password', params: { identifier } });
    },
  });

  return (
    <ScrollView contentContainerClassName="flex-1 justify-center bg-surface-0 px-6 py-12">
      <Text className="mb-1 text-lg font-semibold text-ink">Forgot password</Text>
      <Text className="mb-4 text-sm text-ink-muted">
        Enter your email or mobile number — we&apos;ll send a reset code if an account exists.
      </Text>
      <Field label="Email or mobile number" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
      <Button
        label={mutation.isPending ? 'Sending…' : 'Send reset code'}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ identifier })}
      />
    </ScrollView>
  );
}

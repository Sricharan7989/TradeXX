import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button } from '@/components/button';
import { FormError } from '@/components/form-error';
import { Field } from '@/components/input';
import { ApiError, api } from '@/lib/api-client';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const mutation = useMutation({
    mutationFn: api.resetPassword,
    onSuccess: () => router.replace('/(auth)/login'),
  });

  return (
    <ScrollView contentContainerClassName="flex-1 justify-center bg-surface-0 px-6 py-12">
      <Text className="mb-1 text-lg font-semibold text-ink">Reset password</Text>
      <Text className="mb-4 text-sm text-ink-muted">Enter the code you received and choose a new password.</Text>

      <FormError message={mutation.error instanceof ApiError ? mutation.error.message : null} />
      <Field label="Email or mobile number" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
      <Field
        label="Reset code"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
      />
      <Field label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      <Button
        label={mutation.isPending ? 'Resetting…' : 'Reset password'}
        loading={mutation.isPending}
        onPress={() => mutation.mutate({ identifier, otp, new_password: newPassword })}
      />
    </ScrollView>
  );
}

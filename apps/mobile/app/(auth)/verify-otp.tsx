import { useMutation } from '@tanstack/react-query';
import type { OtpPurpose } from '@tradex/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';


import { Button } from '@/components/button';
import { FormError } from '@/components/form-error';
import { Field } from '@/components/input';
import { ApiError, api } from '@/lib/api-client';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ identifier?: string; purpose?: OtpPurpose }>();
  const identifier = params.identifier ?? '';
  const purpose = params.purpose ?? 'SIGNUP';

  const [otp, setOtp] = useState('');
  const [resent, setResent] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: api.verifyOtp,
    onSuccess: () => router.replace('/(auth)/login'),
  });

  const resendMutation = useMutation({
    mutationFn: api.resendOtp,
    onSuccess: () => setResent(true),
  });

  return (
    <ScrollView contentContainerClassName="flex-1 justify-center bg-surface-0 px-6 py-12">
      <Text className="mb-1 text-lg font-semibold text-ink">Verify your account</Text>
      <Text className="mb-4 text-sm text-ink-muted">Enter the 6-digit code sent to {identifier}.</Text>

      <FormError message={verifyMutation.error instanceof ApiError ? verifyMutation.error.message : null} />
      <Field
        label="Verification code"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
      />
      <Button
        label={verifyMutation.isPending ? 'Verifying…' : 'Verify'}
        loading={verifyMutation.isPending}
        onPress={() => verifyMutation.mutate({ identifier, otp, purpose })}
      />
      <Button
        label={resent ? 'Code resent' : 'Resend code'}
        variant="ghost"
        onPress={() => resendMutation.mutate({ identifier, purpose })}
      />
    </ScrollView>
  );
}

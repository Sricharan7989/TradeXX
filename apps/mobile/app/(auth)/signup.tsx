import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FormError } from '@/components/form-error';
import { Field } from '@/components/input';
import { ApiError, api } from '@/lib/api-client';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: api.signup,
    onSuccess: () => {
      router.push({ pathname: '/(auth)/verify-otp', params: { identifier: email, purpose: 'SIGNUP' } });
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface-0">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 py-12">
        <Text className="mb-8 text-center text-xl font-semibold text-ink">Tradex</Text>
        <Text className="mb-1 text-lg font-semibold text-ink">Create your account</Text>
        <Text className="mb-4 text-sm text-ink-muted">Start trading in paper mode — no real money at risk.</Text>

        <FormError message={mutation.error instanceof ApiError ? mutation.error.message : null} />
        <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Mobile number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Text className="mb-4 text-xs text-ink-faint">
          At least 8 characters, with an uppercase letter, a digit, and a symbol.
        </Text>
        <Button
          label={mutation.isPending ? 'Creating account…' : 'Sign up'}
          loading={mutation.isPending}
          onPress={() => mutation.mutate({ email, phone, password })}
        />

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-sm text-ink-muted">Already have an account?</Text>
          <Link href="/(auth)/login" className="text-sm text-accent-400">
            Log in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

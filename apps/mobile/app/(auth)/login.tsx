import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FormError } from '@/components/form-error';
import { Field } from '@/components/input';
import { ApiError, api } from '@/lib/api-client';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (result) => {
      if (result.mfa_required) {
        setMfaToken(result.mfa_token);
        return;
      }
      router.replace('/(app)/watchlist');
    },
  });

  const mfaMutation = useMutation({
    mutationFn: api.loginTwoFactor,
    onSuccess: () => router.replace('/(app)/watchlist'),
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-surface-0">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 py-12">
        <Text className="mb-8 text-center text-xl font-semibold text-ink">Tradex</Text>

        {mfaToken ? (
          <View>
            <Text className="mb-1 text-lg font-semibold text-ink">Two-factor authentication</Text>
            <Text className="mb-4 text-sm text-ink-muted">Enter your 6-digit code or a backup code.</Text>
            <FormError message={mfaMutation.error instanceof ApiError ? mfaMutation.error.message : null} />
            <Field
              label="Authentication code"
              autoFocus
              value={totpCode}
              onChangeText={setTotpCode}
              autoCapitalize="none"
            />
            <Button
              label={mfaMutation.isPending ? 'Verifying…' : 'Verify'}
              loading={mfaMutation.isPending}
              onPress={() => mfaMutation.mutate({ mfa_token: mfaToken, totp_code: totpCode })}
            />
          </View>
        ) : (
          <View>
            <Text className="mb-1 text-lg font-semibold text-ink">Log in</Text>
            <Text className="mb-4 text-sm text-ink-muted">Welcome back.</Text>
            <FormError message={loginMutation.error instanceof ApiError ? loginMutation.error.message : null} />
            <Field
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
            <Button
              label={loginMutation.isPending ? 'Logging in…' : 'Log in'}
              loading={loginMutation.isPending}
              onPress={() => loginMutation.mutate({ email, password })}
            />
            <Link href="/(auth)/forgot-password" className="mt-4 text-center text-sm text-accent-400">
              Forgot password?
            </Link>
            <View className="mt-6 flex-row justify-center gap-1">
              <Text className="text-sm text-ink-muted">Don&apos;t have an account?</Text>
              <Link href="/(auth)/signup" className="text-sm text-accent-400">
                Sign up
              </Link>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

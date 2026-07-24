'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type JSX, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

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
      setAuth(result.access_token, result.user);
      router.push('/dashboard');
    },
  });

  const mfaMutation = useMutation({
    mutationFn: api.loginTwoFactor,
    onSuccess: (result) => {
      setAuth(result.access_token, result.user);
      router.push('/dashboard');
    },
  });

  if (mfaToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>Enter the 6-digit code from your authenticator app, or a backup code.</CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mfaMutation.mutate({ mfa_token: mfaToken, totp_code: totpCode });
          }}
          className="space-y-4"
        >
          <FormError message={mfaMutation.error instanceof ApiError ? mfaMutation.error.message : null} />
          <div>
            <Label htmlFor="totp">Authentication code</Label>
            <Input
              id="totp"
              required
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="tracking-[0.3em]"
            />
          </div>
          <Button type="submit" className="w-full" disabled={mfaMutation.isPending}>
            {mfaMutation.isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back to Tradex.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          loginMutation.mutate({ email, password });
        }}
        className="space-y-4"
      >
        <FormError message={loginMutation.error instanceof ApiError ? loginMutation.error.message : null} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="mb-1.5 text-xs text-accent-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-accent-400 hover:underline">
          Sign up
        </Link>
      </p>
    </Card>
  );
}

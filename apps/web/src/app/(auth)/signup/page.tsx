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

export default function SignupPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: api.signup,
    onSuccess: () => {
      router.push(`/verify-otp?identifier=${encodeURIComponent(email)}&purpose=SIGNUP`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ email, phone, password });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start trading in paper mode — no real money at risk.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={mutation.error instanceof ApiError ? mutation.error.message : null} />
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
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            type="tel"
            required
            placeholder="9876543210"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-faint">
            At least 8 characters, with an uppercase letter, a digit, and a symbol.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-accent-400 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}

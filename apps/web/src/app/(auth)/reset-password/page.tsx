'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, type JSX, Suspense, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';

function ResetPasswordForm(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState(params.get('identifier') ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const mutation = useMutation({
    mutationFn: api.resetPassword,
    onSuccess: () => {
      router.push('/login?reset=1');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ identifier, otp, new_password: newPassword });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter the code you received and choose a new password.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={mutation.error instanceof ApiError ? mutation.error.message : null} />
        <div>
          <Label htmlFor="identifier">Email or mobile number</Label>
          <Input id="identifier" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="otp">Reset code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="tracking-[0.5em]"
          />
        </div>
        <div>
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

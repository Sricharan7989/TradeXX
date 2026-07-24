'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, type JSX, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

export default function ForgotPasswordPage(): JSX.Element {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');

  const mutation = useMutation({
    mutationFn: api.forgotPassword,
    onSuccess: () => {
      router.push(`/reset-password?identifier=${encodeURIComponent(identifier)}`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ identifier });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your email or mobile number — we&apos;ll send a reset code if an account exists.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="identifier">Email or mobile number</Label>
          <Input id="identifier" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reset code'}
        </Button>
      </form>
    </Card>
  );
}

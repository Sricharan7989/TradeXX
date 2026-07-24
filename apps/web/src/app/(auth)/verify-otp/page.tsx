'use client';

import { useMutation } from '@tanstack/react-query';
import type { OtpPurpose } from '@tradex/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, type JSX, Suspense, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';

function VerifyOtpForm(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const identifier = params.get('identifier') ?? '';
  const purpose = (params.get('purpose') as OtpPurpose | null) ?? 'SIGNUP';

  const [otp, setOtp] = useState('');
  const [resent, setResent] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: api.verifyOtp,
    onSuccess: () => {
      router.push('/login?verified=1');
    },
  });

  const resendMutation = useMutation({
    mutationFn: api.resendOtp,
    onSuccess: () => setResent(true),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    verifyMutation.mutate({ identifier, otp, purpose });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your account</CardTitle>
        <CardDescription>Enter the 6-digit code sent to {identifier || 'your email'}.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={verifyMutation.error instanceof ApiError ? verifyMutation.error.message : null} />
        <div>
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="tracking-[0.5em]"
          />
        </div>
        <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
          {verifyMutation.isPending ? 'Verifying…' : 'Verify'}
        </Button>
      </form>
      <button
        type="button"
        onClick={() => resendMutation.mutate({ identifier, purpose })}
        disabled={resendMutation.isPending}
        className="mt-4 w-full text-center text-sm text-accent-400 hover:underline disabled:opacity-50"
      >
        {resent ? 'Code resent — check again shortly' : 'Resend code'}
      </button>
    </Card>
  );
}

export default function VerifyOtpPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}

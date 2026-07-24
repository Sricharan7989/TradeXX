'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { KycSubmitInput } from '@tradex/types';
import { useRouter } from 'next/navigation';
import { type FormEvent, type JSX, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, api } from '@/lib/api-client';

const STEPS = ['Personal', 'Identity', 'Address', 'Bank', 'Review'] as const;

type FormState = Partial<KycSubmitInput>;

function Field({
  id,
  label,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>): JSX.Element {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

export default function KycPage(): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({});

  const statusQuery = useQuery({ queryKey: ['kyc-status'], queryFn: api.kycStatus });

  const submitMutation = useMutation({
    mutationFn: (input: KycSubmitInput) => api.kycSubmit(input),
    onSuccess: () => {
      router.push('/dashboard');
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isLastStep = step === STEPS.length - 1;

  function next(e: FormEvent) {
    e.preventDefault();
    if (isLastStep) {
      submitMutation.mutate(form as KycSubmitInput);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  if (statusQuery.data?.kyc_status === 'SUBMITTED') {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">KYC under review</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your details were submitted on{' '}
          {statusQuery.data.submitted_at ? new Date(statusQuery.data.submitted_at).toLocaleDateString('en-IN') : '—'}
          . We&apos;ll notify you once verification is complete.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      <h1 className="mb-1 text-xl font-semibold text-ink">Complete your KYC</h1>
      <p className="mb-6 text-sm text-ink-muted">Required before you can trade in LIVE mode.</p>

      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ' +
                (i <= step ? 'bg-accent-500 text-white' : 'bg-surface-2 text-ink-faint')
              }
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={'h-px flex-1 ' + (i < step ? 'bg-accent-500' : 'bg-surface-border')} />
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={next} className="space-y-4">
        <FormError message={submitMutation.error instanceof ApiError ? submitMutation.error.message : null} />

        {step === 0 && (
          <>
            <Field id="full_name" label="Full name (as per PAN)" required value={form.full_name ?? ''} onChange={(v) => set('full_name', v)} />
            <Field
              id="dob"
              label="Date of birth"
              type="date"
              required
              value={form.date_of_birth ?? ''}
              onChange={(v) => set('date_of_birth', v)}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Field
              id="pan"
              label="PAN"
              required
              placeholder="ABCDE1234F"
              maxLength={10}
              value={form.pan ?? ''}
              onChange={(v) => set('pan', v.toUpperCase())}
            />
            <Field
              id="aadhaar_last4"
              label="Aadhaar — last 4 digits"
              required
              maxLength={4}
              inputMode="numeric"
              value={form.aadhaar_last4 ?? ''}
              onChange={(v) => set('aadhaar_last4', v.replace(/\D/g, ''))}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Field id="address_line1" label="Address line 1" required value={form.address_line1 ?? ''} onChange={(v) => set('address_line1', v)} />
            <Field id="address_line2" label="Address line 2 (optional)" value={form.address_line2 ?? ''} onChange={(v) => set('address_line2', v)} />
            <div className="grid grid-cols-2 gap-4">
              <Field id="city" label="City" required value={form.city ?? ''} onChange={(v) => set('city', v)} />
              <Field id="state" label="State" required value={form.state ?? ''} onChange={(v) => set('state', v)} />
            </div>
            <Field
              id="pincode"
              label="Pincode"
              required
              maxLength={6}
              inputMode="numeric"
              value={form.pincode ?? ''}
              onChange={(v) => set('pincode', v.replace(/\D/g, ''))}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Field
              id="bank_account_number"
              label="Bank account number"
              required
              inputMode="numeric"
              value={form.bank_account_number ?? ''}
              onChange={(v) => set('bank_account_number', v.replace(/\D/g, ''))}
            />
            <Field
              id="bank_ifsc"
              label="IFSC code"
              required
              placeholder="HDFC0001234"
              maxLength={11}
              value={form.bank_ifsc ?? ''}
              onChange={(v) => set('bank_ifsc', v.toUpperCase())}
            />
            <Field id="dp_id" label="DP ID (optional)" value={form.dp_id ?? ''} onChange={(v) => set('dp_id', v)} />
            <Field
              id="demat_account_number"
              label="Demat account number (optional)"
              value={form.demat_account_number ?? ''}
              onChange={(v) => set('demat_account_number', v)}
            />
          </>
        )}

        {step === 4 && (
          <div className="space-y-2 rounded border border-surface-border bg-surface-2 p-4 text-sm">
            {Object.entries(form).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-ink-muted">{k}</span>
                <span className="text-ink">{String(v || '—')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={submitMutation.isPending}>
            {isLastStep ? (submitMutation.isPending ? 'Submitting…' : 'Submit KYC') : 'Continue'}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useMutation, useQuery } from '@tanstack/react-query';
import type { KycSubmitInput } from '@tradex/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';


import { Button } from '@/components/button';
import { FormError } from '@/components/form-error';
import { Field } from '@/components/input';
import { ApiError, api } from '@/lib/api-client';

const STEPS = ['Personal', 'Identity', 'Address', 'Bank', 'Review'] as const;

type FormState = Partial<KycSubmitInput>;

export default function KycScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({});

  const statusQuery = useQuery({ queryKey: ['kyc-status'], queryFn: api.kycStatus });

  const submitMutation = useMutation({
    mutationFn: (input: KycSubmitInput) => api.kycSubmit(input),
    onSuccess: () => router.replace('/(app)/watchlist'),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isLastStep = step === STEPS.length - 1;

  if (statusQuery.data?.kyc_status === 'SUBMITTED') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-0 px-8">
        <Text className="text-lg font-semibold text-ink">KYC under review</Text>
        <Text className="mt-2 text-center text-sm text-ink-muted">
          We&apos;ll notify you once verification is complete.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface-0" contentContainerClassName="px-6 py-12">
      <Text className="mb-1 text-lg font-semibold text-ink">Complete your KYC</Text>
      <Text className="mb-6 text-sm text-ink-muted">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </Text>

      <FormError message={submitMutation.error instanceof ApiError ? submitMutation.error.message : null} />

      {step === 0 && (
        <>
          <Field label="Full name (as per PAN)" value={form.full_name ?? ''} onChangeText={(v) => set('full_name', v)} />
          <Field
            label="Date of birth (YYYY-MM-DD)"
            value={form.date_of_birth ?? ''}
            onChangeText={(v) => set('date_of_birth', v)}
          />
        </>
      )}

      {step === 1 && (
        <>
          <Field
            label="PAN"
            autoCapitalize="characters"
            maxLength={10}
            value={form.pan ?? ''}
            onChangeText={(v) => set('pan', v.toUpperCase())}
          />
          <Field
            label="Aadhaar — last 4 digits"
            keyboardType="number-pad"
            maxLength={4}
            value={form.aadhaar_last4 ?? ''}
            onChangeText={(v) => set('aadhaar_last4', v.replace(/\D/g, ''))}
          />
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Address line 1" value={form.address_line1 ?? ''} onChangeText={(v) => set('address_line1', v)} />
          <Field
            label="Address line 2 (optional)"
            value={form.address_line2 ?? ''}
            onChangeText={(v) => set('address_line2', v)}
          />
          <Field label="City" value={form.city ?? ''} onChangeText={(v) => set('city', v)} />
          <Field label="State" value={form.state ?? ''} onChangeText={(v) => set('state', v)} />
          <Field
            label="Pincode"
            keyboardType="number-pad"
            maxLength={6}
            value={form.pincode ?? ''}
            onChangeText={(v) => set('pincode', v.replace(/\D/g, ''))}
          />
        </>
      )}

      {step === 3 && (
        <>
          <Field
            label="Bank account number"
            keyboardType="number-pad"
            value={form.bank_account_number ?? ''}
            onChangeText={(v) => set('bank_account_number', v.replace(/\D/g, ''))}
          />
          <Field
            label="IFSC code"
            autoCapitalize="characters"
            maxLength={11}
            value={form.bank_ifsc ?? ''}
            onChangeText={(v) => set('bank_ifsc', v.toUpperCase())}
          />
          <Field label="DP ID (optional)" value={form.dp_id ?? ''} onChangeText={(v) => set('dp_id', v)} />
          <Field
            label="Demat account number (optional)"
            value={form.demat_account_number ?? ''}
            onChangeText={(v) => set('demat_account_number', v)}
          />
        </>
      )}

      {step === 4 && (
        <View className="mb-4 rounded border border-surface-border bg-surface-2 p-4">
          {Object.entries(form).map(([k, v]) => (
            <View key={k} className="flex-row justify-between py-1">
              <Text className="text-sm text-ink-muted">{k}</Text>
              <Text className="text-sm text-ink">{String(v || '—')}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row gap-3">
        {step > 0 && (
          <View className="flex-1">
            <Button label="Back" variant="secondary" onPress={() => setStep((s) => s - 1)} />
          </View>
        )}
        <View className="flex-1">
          <Button
            label={isLastStep ? (submitMutation.isPending ? 'Submitting…' : 'Submit KYC') : 'Continue'}
            loading={submitMutation.isPending}
            onPress={() => {
              if (isLastStep) {
                submitMutation.mutate(form as KycSubmitInput);
              } else {
                setStep((s) => Math.min(s + 1, STEPS.length - 1));
              }
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

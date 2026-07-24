'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DefaultProduct, TradingMode } from '@tradex/types';
import type { JSX } from 'react';

import { AppShell } from '@/components/app-shell';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';

function Row({ label, value }: { label: string; value: string | null | undefined }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2.5 last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm text-ink">{value || '—'}</span>
    </div>
  );
}

export default function ProfilePage(): JSX.Element {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const updateSettings = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  if (!me) {
    return (
      <AppShell>
        <p className="text-sm text-ink-muted">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-lg font-semibold text-ink">Profile</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Your Tradex account details.</CardDescription>
          </CardHeader>
          <Row label="Email" value={me.user.email} />
          <Row label="Phone" value={me.user.phone} />
          <Row label="Status" value={me.user.status} />
          <Row label="KYC status" value={me.profile?.kyc_status ?? 'NOT_STARTED'} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">KYC details</CardTitle>
            <CardDescription>Submitted identity and bank information.</CardDescription>
          </CardHeader>
          {me.profile ? (
            <>
              <Row label="Full name" value={me.profile.full_name} />
              <Row label="Date of birth" value={me.profile.date_of_birth} />
              <Row label="PAN" value={me.profile.pan_masked} />
              <Row label="City" value={me.profile.city} />
              <Row label="State" value={me.profile.state} />
              <Row label="Demat account" value={me.profile.demat_account_number} />
            </>
          ) : (
            <p className="text-sm text-ink-muted">KYC not started yet.</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Trading preferences</CardTitle>
            <CardDescription>Switch between paper and live trading, and set your defaults.</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Trading mode</span>
              <div className="flex gap-2">
                {(['PAPER', 'LIVE'] satisfies TradingMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateSettings.mutate({ trading_mode: mode })}
                    className={
                      'rounded border px-3 py-1.5 text-sm transition-colors ' +
                      (me.settings.trading_mode === mode
                        ? 'border-accent-500 bg-accent-900 text-accent-300'
                        : 'border-surface-border text-ink-muted hover:text-ink')
                    }
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Default product</span>
              <div className="flex gap-2">
                {(['CNC', 'MIS', 'NRML'] satisfies DefaultProduct[]).map((product) => (
                  <button
                    key={product}
                    type="button"
                    onClick={() => updateSettings.mutate({ default_product: product })}
                    className={
                      'rounded border px-3 py-1.5 text-sm transition-colors ' +
                      (me.settings.default_product === product
                        ? 'border-accent-500 bg-accent-900 text-accent-300'
                        : 'border-surface-border text-ink-muted hover:text-ink')
                    }
                  >
                    {product}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={me.settings.order_confirmation_required}
                onChange={(e) => updateSettings.mutate({ order_confirmation_required: e.target.checked })}
                className="h-4 w-4 rounded border-surface-border bg-surface-1"
              />
              Require confirmation before placing an order
            </label>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

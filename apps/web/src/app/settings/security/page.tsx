'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { type FormEvent, type JSX, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe } from '@/hooks/use-auth';
import { ApiError, api } from '@/lib/api-client';

function TwoFactorSetup({ onEnabled }: { onEnabled: () => void }): JSX.Element {
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string; qr_code_data_url: string } | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const setupMutation = useMutation({ mutationFn: api.twofaSetup, onSuccess: setSetup });
  const enableMutation = useMutation({
    mutationFn: api.twofaEnable,
    onSuccess: (res) => {
      setBackupCodes(res.backup_codes);
      onEnabled();
    },
  });

  if (backupCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Save your backup codes</CardTitle>
          <CardDescription>Each code can be used once if you lose access to your authenticator app.</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 rounded border border-surface-border bg-surface-2 p-4 font-mono text-sm text-ink">
          {backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
      </Card>
    );
  }

  if (!setup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
          {setupMutation.isPending ? 'Generating…' : 'Set up 2FA'}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scan with your authenticator app</CardTitle>
        <CardDescription>Google Authenticator, Authy, 1Password, etc.</CardDescription>
      </CardHeader>
      <div className="flex flex-col items-center gap-4">
        <Image
          src={setup.qr_code_data_url}
          alt="2FA QR code"
          width={200}
          height={200}
          unoptimized
          className="rounded bg-white p-2"
        />
        <p className="break-all text-center text-xs text-ink-faint">{setup.secret}</p>
        <form
          className="flex w-full max-w-xs gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            enableMutation.mutate({ totp_code: code });
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
          <Button type="submit" disabled={enableMutation.isPending}>
            Enable
          </Button>
        </form>
        <FormError message={enableMutation.error instanceof ApiError ? enableMutation.error.message : null} />
      </div>
    </Card>
  );
}

function DisableTwoFactor({ onDisabled }: { onDisabled: () => void }): JSX.Element {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const mutation = useMutation({ mutationFn: api.twofaDisable, onSuccess: onDisabled });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Two-factor authentication is on</CardTitle>
        <CardDescription>Disable it with your password and a current code.</CardDescription>
      </CardHeader>
      <form
        className="space-y-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          mutation.mutate({ password, totp_code: code });
        }}
      >
        <FormError message={mutation.error instanceof ApiError ? mutation.error.message : null} />
        <div>
          <Label htmlFor="disable-password">Password</Label>
          <Input id="disable-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="disable-code">Authentication code</Label>
          <Input id="disable-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
        </div>
        <Button type="submit" variant="destructive" disabled={mutation.isPending}>
          {mutation.isPending ? 'Disabling…' : 'Disable 2FA'}
        </Button>
      </form>
    </Card>
  );
}

function SessionsList(): JSX.Element {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({ queryKey: ['sessions'], queryFn: api.sessions });
  const revokeMutation = useMutation({
    mutationFn: api.revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Active sessions</CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
      </CardHeader>
      <div className="space-y-2">
        {sessionsQuery.data?.sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded border border-surface-border px-3 py-2.5"
          >
            <div>
              <p className="text-sm text-ink">
                {s.device_name || s.device_id} <span className="text-ink-faint">· {s.platform}</span>
                {s.is_current && (
                  <span className="ml-2 rounded-full bg-gain-muted px-2 py-0.5 text-xs text-gain">This device</span>
                )}
              </p>
              <p className="text-xs text-ink-faint">
                Last used {s.last_used_at ? new Date(s.last_used_at).toLocaleString('en-IN') : 'never'}
              </p>
            </div>
            {!s.is_current && (
              <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(s.id)}>
                Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SecurityPage(): JSX.Element {
  const { data: me, refetch } = useMe();

  return (
    <AppShell>
      <h1 className="mb-6 text-lg font-semibold text-ink">Security</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {me?.user.is_2fa_enabled ? (
          <DisableTwoFactor onDisabled={() => refetch()} />
        ) : (
          <TwoFactorSetup onEnabled={() => refetch()} />
        )}
        <SessionsList />
      </div>
    </AppShell>
  );
}

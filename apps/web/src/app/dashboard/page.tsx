'use client';

import type { JSX } from 'react';

import { AppShell } from '@/components/app-shell';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/hooks/use-auth';

const PLACEHOLDER_TILES = ['Watchlist', 'Orders', 'Portfolio', 'Funds'] as const;

export default function DashboardPage(): JSX.Element {
  const { data: me } = useMe();

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-muted">
            {me ? `Trading mode: ${me.settings.trading_mode}` : 'Loading account…'}
          </p>
        </div>
        {me?.settings.trading_mode === 'PAPER' && (
          <span className="rounded-full bg-accent-900 px-3 py-1 text-xs font-medium text-accent-300">
            Paper trading
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_TILES.map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>Coming in a later phase.</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

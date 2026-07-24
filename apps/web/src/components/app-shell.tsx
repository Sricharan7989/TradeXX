'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth-store';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/security', label: 'Security' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="border-b border-surface-border bg-surface-1">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="text-base font-semibold text-ink">Tradex</span>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'rounded px-3 py-1.5 text-sm transition-colors ' +
                    (pathname === item.href ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink')
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

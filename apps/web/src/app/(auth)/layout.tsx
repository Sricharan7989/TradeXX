import type { JSX } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="text-xl font-semibold tracking-tight text-ink">Tradex</span>
        </div>
        {children}
      </div>
    </div>
  );
}

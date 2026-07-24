import type { JSX } from 'react';

export function FormError({ message }: { message?: string | null }): JSX.Element | null {
  if (!message) return null;
  return (
    <div role="alert" className="rounded border border-loss/30 bg-loss-muted px-3 py-2 text-sm text-loss">
      {message}
    </div>
  );
}

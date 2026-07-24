import type { InputHTMLAttributes, JSX } from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cn(
        'h-10 w-full rounded border border-surface-border bg-surface-1 px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-500 focus:ring-1 focus:ring-accent-500',
        className,
      )}
      {...props}
    />
  );
}

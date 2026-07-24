import type { InputHTMLAttributes, JSX } from 'react';

import { cn } from '@/lib/utils';

// `<input>` never renders children — omitting the field (inherited but
// always-unused) sidesteps a cross-package @types/react comparison issue;
// see unsafeChildren's doc comment in lib/utils.ts for the full story.
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>;

export function Input({ className, ...props }: InputProps): JSX.Element {
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

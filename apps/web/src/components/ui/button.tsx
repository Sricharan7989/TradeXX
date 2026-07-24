import { type VariantProps, cva } from 'class-variance-authority';
import type { ComponentProps, JSX, ReactNode } from 'react';

import { cn, unsafeChildren } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent-500 text-white hover:bg-accent-600',
        secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-surface-border',
        ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
        destructive: 'bg-loss text-white hover:bg-loss/90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

// `ref` is omitted deliberately (not just for typing convenience): this
// component doesn't forward refs, and including it — or the inherited
// `children` field — hits a cross-package @types/react resolution issue in
// this monorepo (web's React 19 types vs. types reachable via apps/mobile's
// React Native 18 during Next's build-time program construction). `children`
// is re-declared explicitly against this file's own `react` import to work
// around it.
export interface ButtonProps
  extends Omit<ComponentProps<'button'>, 'ref' | 'children'>,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode;
}

export function Button({ className, variant, size, children, ...props }: ButtonProps): JSX.Element {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {unsafeChildren(children)}
    </button>
  );
}

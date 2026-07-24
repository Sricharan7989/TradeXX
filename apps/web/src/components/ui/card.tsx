import type { HTMLAttributes, JSX } from 'react';

import { cn, unsafeChildren } from '@/lib/utils';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('rounded-lg border border-surface-border bg-surface-1 p-6', className)} {...props}>
      {unsafeChildren(children)}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('mb-5', className)} {...props}>
      {unsafeChildren(children)}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  return (
    <h1 className={cn('text-lg font-semibold text-ink', className)} {...props}>
      {unsafeChildren(children)}
    </h1>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return (
    <p className={cn('mt-1 text-sm text-ink-muted', className)} {...props}>
      {unsafeChildren(children)}
    </p>
  );
}

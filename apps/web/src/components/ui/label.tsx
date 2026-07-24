import type { JSX, LabelHTMLAttributes } from 'react';

import { cn, unsafeChildren } from '@/lib/utils';

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  return (
    <label className={cn('mb-1.5 block text-xs font-medium text-ink-muted', className)} {...props}>
      {unsafeChildren(children)}
    </label>
  );
}

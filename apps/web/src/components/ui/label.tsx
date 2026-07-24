import type { JSX, LabelHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>): JSX.Element {
  return <label className={cn('mb-1.5 block text-xs font-medium text-ink-muted', className)} {...props} />;
}

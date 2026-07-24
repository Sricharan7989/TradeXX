import { type ClassValue, clsx } from 'clsx';
import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * This monorepo has two @types/react major-version lines in play (apps/web's
 * React 19 and apps/mobile's React Native 18), and Next's build-time program
 * construction occasionally compares a `ReactNode` resolved through one
 * against the global JSX namespace's reference to the other — structurally
 * identical, not nominally unified, so TS refuses to unify them (TS2322,
 * "Two different types with this name exist, but they are unrelated").
 * Purely a static-analysis artifact confined to this workspace's dependency
 * graph; the value renders exactly as written at runtime. Used at the few
 * JSX call sites (thin native-element wrapper components) where the
 * comparison is otherwise unavoidable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export function unsafeChildren(children: ReactNode): any {
  return children;
}

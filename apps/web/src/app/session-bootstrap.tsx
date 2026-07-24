'use client';

import { useSessionBootstrap } from '@/hooks/use-auth';

/** Thin client wrapper so the root layout (a server component) can still
 *  kick off session bootstrap on mount without itself being a client component. */
export function SessionBootstrap(): null {
  useSessionBootstrap();
  return null;
}

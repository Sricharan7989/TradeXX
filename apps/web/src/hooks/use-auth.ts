'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Runs once per app load (mounted from the root layout): the access token
 * lives in memory only (per spec), so a hard refresh always starts empty —
 * this silently exchanges the httpOnly refresh cookie for a new access
 * token so the client doesn't bounce the user back to /login unnecessarily.
 *
 * Note: middleware.ts performs its own refresh to gate protected routes
 * server-side; this client-side call is what actually populates the
 * in-memory token React components use to call the API. Phase 1 accepts
 * the resulting double-refresh-per-navigation as a known tradeoff of the
 * memory-only access token design — a later phase can hand the
 * middleware-minted token to the client via a short-lived header instead.
 */
export function useSessionBootstrap(): void {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;

    (async () => {
      try {
        // apiFetch transparently exchanges the refresh cookie for a fresh
        // access token on a 401 and sets it in the store as a side effect
        // (see trySilentRefresh in api-client.ts) — by the time this
        // resolves, accessToken is already populated; we only need to
        // record the user here.
        const me = await api.me();
        if (!cancelled) {
          setUser({ id: me.user.id, email: me.user.email, status: me.user.status });
        }
      } catch {
        if (!cancelled) clearAuth();
      } finally {
        if (!cancelled) setHydrated();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
}

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: accessToken !== null,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

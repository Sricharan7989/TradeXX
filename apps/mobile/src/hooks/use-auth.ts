import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api, bootstrapSession } from '../lib/api-client';
import { useAuthStore } from '../lib/auth-store';

/** Runs once on app boot: exchanges the secure-store refresh token (if any) for a fresh access token. */
export function useSessionBootstrap(): void {
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) {
      void bootstrapSession();
    }
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
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => queryClient.clear(),
  });
}

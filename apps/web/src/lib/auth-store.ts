import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  status: string;
}

interface AuthState {
  /** Access token — memory only, per spec. Never persisted to storage. */
  accessToken: string | null;
  user: AuthUser | null;
  /** True once the initial silent-refresh-on-load attempt has finished. */
  hydrated: boolean;
  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  /** Updates just the user, leaving accessToken as-is (e.g. after apiFetch's
   *  own silent-refresh-and-retry already set the token as a side effect —
   *  see useSessionBootstrap). */
  setUser: (user: AuthUser) => void;
  setHydrated: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setHydrated: () => set({ hydrated: true }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));

import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  status: string;
}

interface AuthState {
  /** Access token — memory only. The refresh token is what's persisted (in
   *  expo-secure-store, see secure-store.ts), same split as web. */
  accessToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
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

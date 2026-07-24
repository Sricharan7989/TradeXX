import type {
  ForgotPasswordInput,
  KycStatusResponse,
  KycSubmitInput,
  LoginInput,
  Login2faInput,
  MeResponse,
  ResendOtpInput,
  ResetPasswordInput,
  SessionDto,
  SignupInput,
  TwoFaDisableInput,
  TwoFaEnableInput,
  TwoFaEnableResponse,
  TwoFaSetupResponse,
  UpdateSettingsInput,
  VerifyOtpInput,
} from '@tradex/types';

import { useAuthStore } from './auth-store';
import { getDeviceContext } from './device';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from './secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the secure-store refresh token for a fresh access token (and rotates it). Single-flight. */
async function trySilentRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return false;

        const res = await fetch(`${API_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;

        const data = (await res.json()) as { access_token: string; refresh_token: string };
        useAuthStore.getState().setAccessToken(data.access_token);
        await setRefreshToken(data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}, isRetry = false): Promise<T> {
  const { skipAuth, headers: optionHeaders, ...rest } = options;
  const headers = new Headers(optionHeaders);
  if (!headers.has('Content-Type') && rest.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = useAuthStore.getState().accessToken;
  if (token && !skipAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });

  if (res.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await trySilentRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
    useAuthStore.getState().clearAuth();
    await clearRefreshToken();
  }

  const contentType = res.headers.get('content-type');
  const body: unknown = contentType?.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const errorBody = body as { error?: { code: string; message: string; details?: unknown } } | null;
    const err = errorBody?.error ?? { code: 'UNKNOWN', message: `Request failed (${res.status})` };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }

  return body as T;
}

function post<T>(path: string, input: unknown, opts: FetchOptions = {}): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(input ?? {}), ...opts });
}

export interface LoginSuccess {
  mfa_required: false;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  user: { id: string; email: string; status: string };
}
export interface LoginMfaRequired {
  mfa_required: true;
  mfa_token: string;
}

/** Persists both halves of a successful login: access token in memory, refresh token in secure-store. */
async function persistSession(result: LoginSuccess): Promise<LoginSuccess> {
  useAuthStore.getState().setAuth(result.access_token, result.user);
  await setRefreshToken(result.refresh_token);
  return result;
}

export const api = {
  signup: (input: SignupInput) => post<{ message: string }>('/v1/auth/signup', input, { skipAuth: true }),

  verifyOtp: (input: VerifyOtpInput) => post<{ message: string }>('/v1/auth/verify-otp', input, { skipAuth: true }),

  resendOtp: (input: ResendOtpInput) => post<{ message: string }>('/v1/auth/resend-otp', input, { skipAuth: true }),

  login: async (input: Omit<LoginInput, 'device'>) => {
    const result = await post<LoginSuccess | LoginMfaRequired>(
      '/v1/auth/login',
      { ...input, device: await getDeviceContext() },
      { skipAuth: true },
    );
    return result.mfa_required ? result : persistSession(result);
  },

  loginTwoFactor: async (input: Omit<Login2faInput, 'device'>) => {
    const result = await post<LoginSuccess>(
      '/v1/auth/login/2fa',
      { ...input, device: await getDeviceContext() },
      { skipAuth: true },
    );
    return persistSession(result);
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();
    const result = await post<{ message: string }>('/v1/auth/logout', { refresh_token: refreshToken });
    await clearRefreshToken();
    useAuthStore.getState().clearAuth();
    return result;
  },

  forgotPassword: (input: ForgotPasswordInput) =>
    post<{ message: string }>('/v1/auth/forgot-password', input, { skipAuth: true }),

  resetPassword: (input: ResetPasswordInput) =>
    post<{ message: string }>('/v1/auth/reset-password', input, { skipAuth: true }),

  sessions: () => apiFetch<{ sessions: SessionDto[] }>('/v1/auth/sessions'),

  revokeSession: (id: string) => apiFetch<{ message: string }>(`/v1/auth/sessions/${id}`, { method: 'DELETE' }),

  me: () => apiFetch<MeResponse>('/v1/me'),

  updateSettings: (input: UpdateSettingsInput) =>
    apiFetch<{ message: string }>('/v1/me/settings', { method: 'PATCH', body: JSON.stringify(input) }),

  kycSubmit: (input: KycSubmitInput) => post<{ message: string }>('/v1/kyc/submit', input),

  kycStatus: () => apiFetch<KycStatusResponse>('/v1/kyc/status'),

  twofaSetup: () => post<TwoFaSetupResponse>('/v1/2fa/setup', undefined),

  twofaEnable: (input: TwoFaEnableInput) => post<TwoFaEnableResponse>('/v1/2fa/enable', input),

  twofaDisable: (input: TwoFaDisableInput) => post<{ message: string }>('/v1/2fa/disable', input),
};

/** Attempts a silent login on app boot using the stored refresh token. */
export async function bootstrapSession(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().setHydrated();
    return;
  }
  try {
    const me = await apiFetch<MeResponse>('/v1/me'); // triggers the 401 -> refresh -> retry path
    useAuthStore.getState().setUser({ id: me.user.id, email: me.user.email, status: me.user.status });
  } catch {
    useAuthStore.getState().clearAuth();
    await clearRefreshToken();
  } finally {
    useAuthStore.getState().setHydrated();
  }
}

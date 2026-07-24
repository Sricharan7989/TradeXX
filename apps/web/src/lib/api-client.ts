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
  /** Skip attaching the Authorization header (unauthenticated endpoints). */
  skipAuth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the httpOnly refresh cookie for a fresh access token. Single-flight. */
async function trySilentRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { access_token: string };
        useAuthStore.getState().setAccessToken(data.access_token);
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

  const res = await fetch(`/api${path}`, { ...rest, headers, credentials: 'include' });

  if (res.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await trySilentRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
    useAuthStore.getState().clearAuth();
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
  refresh_token?: string;
  user: { id: string; email: string; status: string };
}
export interface LoginMfaRequired {
  mfa_required: true;
  mfa_token: string;
}

export const api = {
  signup: (input: SignupInput) => post<{ message: string }>('/v1/auth/signup', input, { skipAuth: true }),

  verifyOtp: (input: VerifyOtpInput) => post<{ message: string }>('/v1/auth/verify-otp', input, { skipAuth: true }),

  resendOtp: (input: ResendOtpInput) => post<{ message: string }>('/v1/auth/resend-otp', input, { skipAuth: true }),

  login: (input: Omit<LoginInput, 'device'>) =>
    post<LoginSuccess | LoginMfaRequired>(
      '/v1/auth/login',
      { ...input, device: getDeviceContext() },
      { skipAuth: true },
    ),

  loginTwoFactor: (input: Omit<Login2faInput, 'device'>) =>
    post<LoginSuccess>('/v1/auth/login/2fa', { ...input, device: getDeviceContext() }, { skipAuth: true }),

  logout: () => post<{ message: string }>('/v1/auth/logout', {}),

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

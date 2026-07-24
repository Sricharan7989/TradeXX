import { ERROR_CODES, type ErrorCode } from '@tradex/types';

/** Thrown anywhere in a route/service; the global error handler formats it. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, ERROR_CODES.VALIDATION_FAILED, message, details);

export const unauthorized = (message = 'Unauthorized'): AppError =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message = 'Forbidden'): AppError => new AppError(403, ERROR_CODES.FORBIDDEN, message);

export const notFound = (message = 'Not found'): AppError => new AppError(404, ERROR_CODES.NOT_FOUND, message);

export const conflict = (message: string): AppError => new AppError(409, ERROR_CODES.CONFLICT, message);

export const rateLimited = (message = 'Too many requests'): AppError =>
  new AppError(429, ERROR_CODES.RATE_LIMITED, message);

// 423 Locked — the account is temporarily locked out after too many failed
// login attempts (GLOBAL security rule: 5 failed attempts -> 15 min lockout).
export const accountLocked = (message = 'Account temporarily locked. Try again later.'): AppError =>
  new AppError(423, ERROR_CODES.ACCOUNT_LOCKED, message);

// Deliberately generic per spec: "never reveal whether an email exists".
export const invalidCredentials = (): AppError =>
  new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');

export const otpInvalid = (): AppError => new AppError(400, ERROR_CODES.OTP_INVALID, 'Invalid or expired code');

export const otpExpired = (): AppError => new AppError(400, ERROR_CODES.OTP_EXPIRED, 'Code has expired');

export const otpMaxAttempts = (): AppError =>
  new AppError(429, ERROR_CODES.OTP_MAX_ATTEMPTS, 'Too many incorrect attempts — request a new code');

export const mfaRequired = (): AppError =>
  new AppError(401, ERROR_CODES.MFA_REQUIRED, 'MFA verification required');

export const mfaInvalid = (): AppError => new AppError(401, ERROR_CODES.MFA_INVALID, 'Invalid authentication code');

export const tokenInvalid = (message = 'Invalid token'): AppError =>
  new AppError(401, ERROR_CODES.TOKEN_INVALID, message);

export const tokenExpired = (): AppError => new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Token expired');

export const tokenReuseDetected = (): AppError =>
  new AppError(401, ERROR_CODES.TOKEN_REUSE_DETECTED, 'Token reuse detected — all sessions have been revoked');

export const internalError = (message = 'Internal server error'): AppError =>
  new AppError(500, ERROR_CODES.INTERNAL_ERROR, message);

import rateLimit from '@fastify/rate-limit';
import {
  forgotPasswordSchema,
  idParamSchema,
  loginSchema,
  login2faSchema,
  logoutSchema,
  refreshSchema,
  resendOtpSchema,
  resetPasswordSchema,
  sessionsListResponseSchema,
  signupSchema,
  verifyOtpSchema,
} from '@tradex/types';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { env, isProduction } from '../../env';
import { writeAuditLog } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-errors';
import { refreshCookieMaxAgeSeconds } from '../../lib/tokens';
import { authenticate, requireUser } from '../../middleware/authenticate';

import * as authService from './auth.service';

const REFRESH_COOKIE_NAME = 'tradex_refresh_token';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Rate-limited scope: 10 req/min/IP on every /v1/auth/* route (spec).
  // Registered inside this encapsulated plugin so it never affects routes
  // registered elsewhere.
  await app.register(rateLimit, {
    max: env.AUTH_RATE_LIMIT_MAX,
    timeWindow: env.AUTH_RATE_LIMIT_WINDOW,
    redis: app.redis,
    nameSpace: 'rl-auth:',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  function setRefreshCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      // Deliberately `/` (not just /v1/auth): the web app's middleware needs
      // to see this cookie on ordinary page navigations (/dashboard,
      // /settings/*) to gate them, and the browser only attaches a cookie to
      // requests under its `path`. The web app fronts the API through a
      // same-origin Next.js rewrite (next.config.js) precisely so this
      // SameSite=Strict cookie is viable at all — see apps/web/README notes.
      path: '/',
      maxAge: refreshCookieMaxAgeSeconds(),
    });
  }

  /** Reads the raw refresh token from the body (mobile) or cookie (web). */
  function readRefreshToken(request: FastifyRequest, bodyToken?: string): string {
    const cookieToken = request.cookies[REFRESH_COOKIE_NAME];
    const token = bodyToken ?? cookieToken;
    if (!token) throw badRequest('Missing refresh token');
    return token;
  }

  typedApp.post('/signup', { schema: { body: signupSchema } }, async (request, reply) => {
    const { userId } = await authService.signup(app.db, request.body);
    await writeAuditLog(app.db, {
      userId,
      action: 'USER_SIGNUP',
      entityType: 'user',
      entityId: userId,
      ipAddress: request.ip,
    });
    return reply.status(201).send({ message: 'Account created. Check your email for a verification code.' });
  });

  typedApp.post('/verify-otp', { schema: { body: verifyOtpSchema } }, async (request, reply) => {
    await authService.verifyOtpAndMarkFlags(app.db, request.body);
    await writeAuditLog(app.db, {
      userId: null,
      action: 'OTP_VERIFIED',
      entityType: 'otp_verification',
      metadata: { identifier: request.body.identifier, purpose: request.body.purpose },
      ipAddress: request.ip,
    });
    return reply.send({ message: 'Verified' });
  });

  typedApp.post('/resend-otp', { schema: { body: resendOtpSchema } }, async (request, reply) => {
    await authService.resendOtp(app.db, app.redis, request.body);
    return reply.send({ message: 'If eligible, a new code has been sent.' });
  });

  typedApp.post('/login', { schema: { body: loginSchema } }, async (request, reply) => {
    const result = await authService.login(app.db, app.redis, request.body, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    await writeAuditLog(app.db, {
      userId: result.mfaRequired ? null : result.user.id,
      action: result.mfaRequired ? 'LOGIN_MFA_REQUIRED' : 'LOGIN_SUCCESS',
      entityType: 'user',
      ipAddress: request.ip,
    });

    if (result.mfaRequired) {
      return reply.send({ mfa_required: true, mfa_token: result.mfaToken });
    }

    if (request.body.device.platform === 'WEB') {
      setRefreshCookie(reply, result.refreshToken);
    }

    return reply.send({
      mfa_required: false,
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      refresh_token: request.body.device.platform === 'WEB' ? undefined : result.refreshToken,
      user: result.user,
    });
  });

  typedApp.post('/login/2fa', { schema: { body: login2faSchema } }, async (request, reply) => {
    const result = await authService.loginWithTwoFactor(
      app.db,
      app.redis,
      { mfaToken: request.body.mfa_token, totpCode: request.body.totp_code, device: request.body.device },
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null },
    );

    await writeAuditLog(app.db, {
      userId: result.user.id,
      action: 'LOGIN_2FA_SUCCESS',
      entityType: 'user',
      entityId: result.user.id,
      ipAddress: request.ip,
    });

    if (request.body.device.platform === 'WEB') {
      setRefreshCookie(reply, result.refreshToken);
    }

    return reply.send({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      refresh_token: request.body.device.platform === 'WEB' ? undefined : result.refreshToken,
      user: result.user,
    });
  });

  typedApp.post('/refresh', { schema: { body: refreshSchema } }, async (request, reply) => {
    const rawToken = readRefreshToken(request, request.body.refresh_token);
    const result = await authService.refresh(app.db, rawToken);

    const cameFromCookie = !request.body.refresh_token;
    if (cameFromCookie) {
      setRefreshCookie(reply, result.refreshToken);
    }

    await writeAuditLog(app.db, {
      userId: null,
      action: 'TOKEN_REFRESHED',
      entityType: 'session',
      ipAddress: request.ip,
    });

    return reply.send({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      refresh_token: cameFromCookie ? undefined : result.refreshToken,
    });
  });

  typedApp.post('/logout', { schema: { body: logoutSchema } }, async (request, reply) => {
    const rawToken = readRefreshToken(request, request.body.refresh_token);
    await authService.logout(app.db, rawToken);
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    await writeAuditLog(app.db, {
      userId: request.user?.sub ?? null,
      action: 'LOGOUT',
      entityType: 'session',
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Logged out' });
  });

  typedApp.post('/forgot-password', { schema: { body: forgotPasswordSchema } }, async (request, reply) => {
    await authService.forgotPassword(app.db, request.body.identifier);
    return reply.send({ message: 'If an account exists, a reset code has been sent.' });
  });

  typedApp.post('/reset-password', { schema: { body: resetPasswordSchema } }, async (request, reply) => {
    await authService.resetPassword(app.db, {
      identifier: request.body.identifier,
      otp: request.body.otp,
      newPassword: request.body.new_password,
    });
    await writeAuditLog(app.db, {
      userId: null,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      metadata: { identifier: request.body.identifier },
      ipAddress: request.ip,
    });
    return reply.send({ message: 'Password reset. Please log in again.' });
  });

  typedApp.get('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const list = await authService.listSessions(app.db, user.sub, user.sid);
    return reply.send(sessionsListResponseSchema.parse({ sessions: list }));
  });

  typedApp.delete(
    '/sessions/:id',
    { schema: { params: idParamSchema }, preHandler: authenticate },
    async (request, reply) => {
      const user = requireUser(request);
      const revoked = await authService.revokeSession(app.db, user.sub, request.params.id);
      if (!revoked) {
        throw notFound('Session not found');
      }
      await writeAuditLog(app.db, {
        userId: user.sub,
        action: 'SESSION_REVOKED',
        entityType: 'session',
        entityId: request.params.id,
        ipAddress: request.ip,
      });
      return reply.send({ message: 'Session revoked' });
    },
  );
}

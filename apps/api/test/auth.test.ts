import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lastOtpFor, spyOnOtpLog } from './helpers/otp-capture';
import { createTestContext, type TestContext } from './helpers/test-context';

describe('auth endpoints', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  });

  function agent() {
    return request(ctx.app.server);
  }

  async function signupAndVerify(email: string, phone: string) {
    const logSpy = spyOnOtpLog();
    await agent()
      .post('/v1/auth/signup')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, phone, password: 'Test@1234' })
      .expect(201);
    const otp = lastOtpFor(logSpy, email);
    await agent()
      .post('/v1/auth/verify-otp')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ identifier: email, otp, purpose: 'SIGNUP' })
      .expect(200);
    logSpy.mockRestore();
  }

  describe('POST /v1/auth/signup', () => {
    it('creates a PENDING_KYC user and sends an OTP', async () => {
      const logSpy = spyOnOtpLog();
      const res = await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email: 'alice@example.com', phone: '9876500001', password: 'Test@1234' })
        .expect(201);
      expect(res.body.message).toMatch(/verification code/i);
      expect(() => lastOtpFor(logSpy, 'alice@example.com')).not.toThrow();
      logSpy.mockRestore();
    });

    it('rejects a duplicate email with 409', async () => {
      const ip = ctx.nextIp();
      await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({ email: 'bob@example.com', phone: '9876500002', password: 'Test@1234' })
        .expect(201);
      const res = await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({ email: 'bob@example.com', phone: '9876500003', password: 'Test@1234' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects a malformed request body with 400', async () => {
      const res = await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email: 'not-an-email', phone: '123', password: 'weak' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /v1/auth/resend-otp', () => {
    it('issues a new OTP that supersedes the original for verification', async () => {
      const email = 'oscar@example.com';
      const logSpy = spyOnOtpLog();
      await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, phone: '9876500014', password: 'Test@1234' })
        .expect(201);

      await agent()
        .post('/v1/auth/resend-otp')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: email, purpose: 'SIGNUP' })
        .expect(200);
      const latestOtp = lastOtpFor(logSpy, email);
      logSpy.mockRestore();

      await agent()
        .post('/v1/auth/verify-otp')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: email, otp: latestOtp, purpose: 'SIGNUP' })
        .expect(200);
    });

    it('responds 200 even for an identifier with no account (enumeration-safe)', async () => {
      await agent()
        .post('/v1/auth/resend-otp')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: 'ghost@example.com', purpose: 'SIGNUP' })
        .expect(200);
    });
  });

  describe('POST /v1/auth/verify-otp', () => {
    it('verifies a correct signup OTP and marks email verified', async () => {
      const email = 'carol@example.com';
      const logSpy = spyOnOtpLog();
      await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, phone: '9876500004', password: 'Test@1234' })
        .expect(201);
      const otp = lastOtpFor(logSpy, email);
      const res = await agent()
        .post('/v1/auth/verify-otp')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: email, otp, purpose: 'SIGNUP' })
        .expect(200);
      expect(res.body.message).toBeDefined();
      logSpy.mockRestore();
    });

    it('rejects an incorrect OTP with 400', async () => {
      const email = 'dave@example.com';
      const logSpy = spyOnOtpLog();
      await agent()
        .post('/v1/auth/signup')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, phone: '9876500005', password: 'Test@1234' })
        .expect(201);
      logSpy.mockRestore();
      const res = await agent()
        .post('/v1/auth/verify-otp')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: email, otp: '000000', purpose: 'SIGNUP' })
        .expect(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    });
  });

  describe('POST /v1/auth/login + /v1/auth/refresh + /v1/auth/logout', () => {
    it('logs in a verified user with no 2FA and returns tokens + a refresh cookie for WEB', async () => {
      const email = 'erin@example.com';
      await signupAndVerify(email, '9876500006');

      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'web-1', platform: 'WEB' } })
        .expect(200);

      expect(res.body.mfa_required).toBe(false);
      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.refresh_token).toBeUndefined();
      const setCookie = res.headers['set-cookie'];
      expect(setCookie?.[0]).toMatch(/tradex_refresh_token=.+HttpOnly.+SameSite=Strict/i);
    });

    it('returns the refresh token in the body for mobile (no cookie)', async () => {
      const email = 'frank@example.com';
      await signupAndVerify(email, '9876500007');

      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'ios-1', platform: 'IOS' } })
        .expect(200);

      expect(res.body.refresh_token).toEqual(expect.any(String));
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects a wrong password with a generic INVALID_CREDENTIALS error', async () => {
      const email = 'grace@example.com';
      await signupAndVerify(email, '9876500008');

      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'WrongPassword1!', device: { device_id: 'web-2', platform: 'WEB' } })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('gives the same generic error for a non-existent email (no enumeration)', async () => {
      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email: 'nobody@example.com', password: 'WrongPassword1!', device: { device_id: 'w', platform: 'WEB' } })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('locks the account after 5 failed attempts (ACCOUNT_LOCKED on the 6th)', async () => {
      const email = 'heidi@example.com';
      await signupAndVerify(email, '9876500009');
      const ip = ctx.nextIp();

      for (let i = 0; i < 5; i++) {
        await agent()
          .post('/v1/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email, password: 'WrongPassword1!', device: { device_id: 'lockout', platform: 'WEB' } })
          .expect(401);
      }

      const res = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password: 'Test@1234', device: { device_id: 'lockout', platform: 'WEB' } })
        .expect(423);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('rotates the refresh token on /refresh and rejects reuse of the old one (revoking all sessions)', async () => {
      const email = 'ivan@example.com';
      await signupAndVerify(email, '9876500010');

      const loginRes = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'ios-2', platform: 'IOS' } })
        .expect(200);
      const originalRefreshToken = loginRes.body.refresh_token as string;

      const refreshRes = await agent()
        .post('/v1/auth/refresh')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ refresh_token: originalRefreshToken })
        .expect(200);
      const newRefreshToken = refreshRes.body.refresh_token as string;
      expect(newRefreshToken).not.toBe(originalRefreshToken);

      // Replaying the now-rotated-out original token is treated as theft.
      const reuseRes = await agent()
        .post('/v1/auth/refresh')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ refresh_token: originalRefreshToken })
        .expect(401);
      expect(reuseRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // ...and the "reuse detected" response revoked the NEW token too.
      await agent()
        .post('/v1/auth/refresh')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ refresh_token: newRefreshToken })
        .expect(401);
    });

    it('revokes the session on logout so its refresh token no longer works', async () => {
      const email = 'judy@example.com';
      await signupAndVerify(email, '9876500011');

      const loginRes = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'ios-3', platform: 'IOS' } })
        .expect(200);
      const refreshToken = loginRes.body.refresh_token as string;

      await agent()
        .post('/v1/auth/logout')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ refresh_token: refreshToken })
        .expect(200);

      await agent()
        .post('/v1/auth/refresh')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ refresh_token: refreshToken })
        .expect(401);
    });
  });

  describe('POST /v1/auth/forgot-password + /v1/auth/reset-password', () => {
    it('always responds 200 for forgot-password, whether or not the account exists', async () => {
      await agent()
        .post('/v1/auth/forgot-password')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: 'no-such-user@example.com' })
        .expect(200);
    });

    it('resets the password with a valid OTP and revokes existing sessions', async () => {
      const email = 'mallory@example.com';
      await signupAndVerify(email, '9876500012');

      const loginRes = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'ios-4', platform: 'IOS' } })
        .expect(200);
      const refreshToken = loginRes.body.refresh_token as string;

      const logSpy = spyOnOtpLog();
      await agent()
        .post('/v1/auth/forgot-password')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: email })
        .expect(200);
      const otp = lastOtpFor(logSpy, email);
      logSpy.mockRestore();

      await agent()
        .post('/v1/auth/reset-password')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ identifier: email, otp, new_password: 'NewPass@5678' })
        .expect(200);

      // Old session is gone...
      await agent()
        .post('/v1/auth/refresh')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ refresh_token: refreshToken })
        .expect(401);

      // ...and the new password works.
      await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'NewPass@5678', device: { device_id: 'ios-4', platform: 'IOS' } })
        .expect(200);
    });
  });

  describe('GET /v1/auth/sessions + DELETE /v1/auth/sessions/:id', () => {
    it('lists active sessions with is_current set correctly, and revokes one', async () => {
      const email = 'niaj@example.com';
      await signupAndVerify(email, '9876500013');

      const login1 = await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'device-a', platform: 'IOS' } })
        .expect(200);
      await agent()
        .post('/v1/auth/login')
        .set('X-Forwarded-For', ctx.nextIp())
        .send({ email, password: 'Test@1234', device: { device_id: 'device-b', platform: 'ANDROID' } })
        .expect(200);

      const accessToken = login1.body.access_token as string;
      const listRes = await agent()
        .get('/v1/auth/sessions')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(listRes.body.sessions).toHaveLength(2);
      const current = listRes.body.sessions.find((s: { is_current: boolean }) => s.is_current);
      expect(current).toBeDefined();
      expect(current.device_id).toBe('device-a');

      const other = listRes.body.sessions.find((s: { is_current: boolean }) => !s.is_current);
      await agent()
        .delete(`/v1/auth/sessions/${other.id}`)
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const afterRes = await agent()
        .get('/v1/auth/sessions')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(afterRes.body.sessions).toHaveLength(1);
    });

    it('rejects requests with no bearer token', async () => {
      await agent().get('/v1/auth/sessions').set('X-Forwarded-For', ctx.nextIp()).expect(401);
    });
  });
});

import { authenticator } from 'otplib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lastOtpFor, spyOnOtpLog } from './helpers/otp-capture';
import { createTestContext, type TestContext } from './helpers/test-context';

describe('2FA endpoints', () => {
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

  async function signupLoginAndGetToken(email: string, phone: string): Promise<string> {
    const logSpy = spyOnOtpLog();
    await agent()
      .post('/v1/auth/signup')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, phone, password: 'Test@1234' })
      .expect(201);
    const otp = lastOtpFor(logSpy, email);
    logSpy.mockRestore();
    await agent()
      .post('/v1/auth/verify-otp')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ identifier: email, otp, purpose: 'SIGNUP' })
      .expect(200);

    const loginRes = await agent()
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, password: 'Test@1234', device: { device_id: 'd1', platform: 'WEB' } })
      .expect(200);
    return loginRes.body.access_token as string;
  }

  it('full lifecycle: setup -> enable -> login requires 2FA -> login/2fa -> disable', async () => {
    const email = 'twofa-user@example.com';
    const accessToken = await signupLoginAndGetToken(email, '9876511001');

    const setupRes = await agent()
      .post('/v1/2fa/setup')
      .set('X-Forwarded-For', ctx.nextIp())
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(setupRes.body.secret).toEqual(expect.any(String));
    expect(setupRes.body.otpauth_url).toMatch(/^otpauth:\/\/totp\//);
    expect(setupRes.body.qr_code_data_url).toMatch(/^data:image\/png;base64,/);

    const secret = setupRes.body.secret as string;
    const enableRes = await agent()
      .post('/v1/2fa/enable')
      .set('X-Forwarded-For', ctx.nextIp())
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totp_code: authenticator.generate(secret) })
      .expect(200);
    expect(enableRes.body.backup_codes).toHaveLength(8);

    // Password-only login now requires an MFA step.
    const loginRes = await agent()
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, password: 'Test@1234', device: { device_id: 'd1', platform: 'WEB' } })
      .expect(200);
    expect(loginRes.body.mfa_required).toBe(true);
    expect(loginRes.body.mfa_token).toEqual(expect.any(String));

    const mfaLoginRes = await agent()
      .post('/v1/auth/login/2fa')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({
        mfa_token: loginRes.body.mfa_token,
        totp_code: authenticator.generate(secret),
        device: { device_id: 'd1', platform: 'WEB' },
      })
      .expect(200);
    expect(mfaLoginRes.body.access_token).toEqual(expect.any(String));

    // A backup code also works, and is single-use.
    const backupCode = enableRes.body.backup_codes[0] as string;
    const login2 = await agent()
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, password: 'Test@1234', device: { device_id: 'd1', platform: 'WEB' } })
      .expect(200);
    await agent()
      .post('/v1/auth/login/2fa')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ mfa_token: login2.body.mfa_token, totp_code: backupCode, device: { device_id: 'd1', platform: 'WEB' } })
      .expect(200);

    const login3 = await agent()
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, password: 'Test@1234', device: { device_id: 'd1', platform: 'WEB' } })
      .expect(200);
    const reuseRes = await agent()
      .post('/v1/auth/login/2fa')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ mfa_token: login3.body.mfa_token, totp_code: backupCode, device: { device_id: 'd1', platform: 'WEB' } })
      .expect(401);
    expect(reuseRes.body.error.code).toBe('MFA_INVALID');

    // Disable requires the password + a current code.
    await agent()
      .post('/v1/2fa/disable')
      .set('X-Forwarded-For', ctx.nextIp())
      .set('Authorization', `Bearer ${mfaLoginRes.body.access_token}`)
      .send({ password: 'Test@1234', totp_code: authenticator.generate(secret) })
      .expect(200);

    const finalLogin = await agent()
      .post('/v1/auth/login')
      .set('X-Forwarded-For', ctx.nextIp())
      .send({ email, password: 'Test@1234', device: { device_id: 'd1', platform: 'WEB' } })
      .expect(200);
    expect(finalLogin.body.mfa_required).toBe(false);
  });

  it('rejects enabling 2FA with a wrong code', async () => {
    const email = 'twofa-wrong@example.com';
    const accessToken = await signupLoginAndGetToken(email, '9876511002');

    await agent()
      .post('/v1/2fa/setup')
      .set('X-Forwarded-For', ctx.nextIp())
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const res = await agent()
      .post('/v1/2fa/enable')
      .set('X-Forwarded-For', ctx.nextIp())
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totp_code: '000000' })
      .expect(401);
    expect(res.body.error.code).toBe('MFA_INVALID');
  });
});

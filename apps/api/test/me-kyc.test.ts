import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lastOtpFor, spyOnOtpLog } from './helpers/otp-capture';
import { createTestContext, type TestContext } from './helpers/test-context';

describe('/v1/me and /v1/kyc', () => {
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

  describe('GET /v1/me + PATCH /v1/me/settings', () => {
    it('returns the user with default settings and a null profile before KYC', async () => {
      const email = 'me-user@example.com';
      const accessToken = await signupLoginAndGetToken(email, '9876522001');

      const res = await agent()
        .get('/v1/me')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.user.email).toBe(email);
      expect(res.body.user.status).toBe('PENDING_KYC');
      expect(res.body.profile).toBeNull();
      expect(res.body.settings).toEqual({
        trading_mode: 'PAPER',
        theme: 'DARK',
        default_product: 'CNC',
        order_confirmation_required: true,
      });
    });

    it('updates settings partially, including trading_mode', async () => {
      const email = 'me-settings@example.com';
      const accessToken = await signupLoginAndGetToken(email, '9876522002');

      await agent()
        .patch('/v1/me/settings')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ trading_mode: 'LIVE', theme: 'LIGHT' })
        .expect(200);

      const res = await agent()
        .get('/v1/me')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.settings.trading_mode).toBe('LIVE');
      expect(res.body.settings.theme).toBe('LIGHT');
      // Untouched fields keep their previous values.
      expect(res.body.settings.default_product).toBe('CNC');
    });

    it('rejects an empty settings patch with 400', async () => {
      const email = 'me-empty@example.com';
      const accessToken = await signupLoginAndGetToken(email, '9876522003');

      const res = await agent()
        .patch('/v1/me/settings')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /v1/kyc/submit + GET /v1/kyc/status', () => {
    // Each test that actually inserts a profile uses its own PAN — the DB
    // enforces one-PAN-per-account (see the dedicated conflict test below),
    // so reusing a PAN across unrelated tests would make them interfere.
    function makeValidKyc(pan: string) {
      return {
        full_name: 'Test User',
        date_of_birth: '1995-06-15',
        pan,
        aadhaar_last4: '1234',
        address_line1: '1 MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        bank_account_number: '123456789012',
        bank_ifsc: 'HDFC0001234',
      };
    }

    it('reports NOT_STARTED before any submission', async () => {
      const accessToken = await signupLoginAndGetToken('kyc-notstarted@example.com', '9876533001');
      const res = await agent()
        .get('/v1/kyc/status')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body).toEqual({ kyc_status: 'NOT_STARTED', kyc_rejection_reason: null, submitted_at: null });
    });

    it('submits KYC, encrypts PAN/bank details, and flips status to SUBMITTED', async () => {
      const accessToken = await signupLoginAndGetToken('kyc-submit@example.com', '9876533002');

      await agent()
        .post('/v1/kyc/submit')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .send(makeValidKyc('ABCPT1234C'))
        .expect(200);

      const statusRes = await agent()
        .get('/v1/kyc/status')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(statusRes.body.kyc_status).toBe('SUBMITTED');
      expect(statusRes.body.submitted_at).toEqual(expect.any(String));

      const meRes = await agent()
        .get('/v1/me')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      // PAN is masked, never returned in plaintext, but shows the real prefix/suffix.
      expect(meRes.body.profile.pan_masked).toBe('AB*******C');
      expect(meRes.body.profile.full_name).toBe('Test User');
    });

    it('rejects a second account submitting the same PAN with 409', async () => {
      const sharedPan = 'DDDDD4444D';
      const accessToken1 = await signupLoginAndGetToken('kyc-pan-a@example.com', '9876533003');
      await agent()
        .post('/v1/kyc/submit')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken1}`)
        .send(makeValidKyc(sharedPan))
        .expect(200);

      const accessToken2 = await signupLoginAndGetToken('kyc-pan-b@example.com', '9876533004');
      const res = await agent()
        .post('/v1/kyc/submit')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken2}`)
        .send(makeValidKyc(sharedPan))
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects an invalid PAN format with 400', async () => {
      const accessToken = await signupLoginAndGetToken('kyc-badpan@example.com', '9876533005');
      const res = await agent()
        .post('/v1/kyc/submit')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...makeValidKyc('EEEEE5555E'), pan: 'not-a-pan' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('requires authentication', async () => {
      await agent().get('/v1/kyc/status').set('X-Forwarded-For', ctx.nextIp()).expect(401);
    });
  });

  describe('POST /v1/kyc/upload (presigned-URL stub) + PUT receiver', () => {
    it('returns an upload target and accepts the file on the local-disk receiver', async () => {
      const accessToken = await signupLoginAndGetToken('kyc-upload@example.com', '9876544001');

      const target = await agent()
        .post('/v1/kyc/upload')
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ doc_type: 'PAN_CARD', file_name: 'pan.jpg', content_type: 'image/jpeg' })
        .expect(200);

      expect(target.body.document_id).toEqual(expect.any(String));
      expect(target.body.upload_url).toBe(`/v1/kyc/upload/${target.body.document_id}`);

      await agent()
        .put(target.body.upload_url)
        .set('X-Forwarded-For', ctx.nextIp())
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'image/jpeg')
        .send(Buffer.from('fake-jpeg-bytes'))
        .expect(200);
    });
  });
});

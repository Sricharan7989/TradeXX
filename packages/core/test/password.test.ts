import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/password';

describe('hashPassword / verifyPassword', () => {
  it('produces an argon2id hash', async () => {
    const hash = await hashPassword('Test@1234');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('Test@1234');
    expect(await verifyPassword(hash, 'Test@1234')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Test@1234');
    expect(await verifyPassword(hash, 'WrongPassword1!')).toBe(false);
  });

  it('returns false rather than throwing for a malformed hash', async () => {
    expect(await verifyPassword('not-a-real-hash', 'Test@1234')).toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('Test@1234');
    const b = await hashPassword('Test@1234');
    expect(a).not.toBe(b);
  });
});

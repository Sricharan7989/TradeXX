import { type MockInstance, vi } from 'vitest';

/**
 * Phase 1 has no real email/SMS provider — issueOtp() logs
 * "[otp:dev] <purpose> code for <identifier>: <code>" (see
 * src/lib/otp-service.ts). Tests capture that line via a console.log spy
 * rather than reading the DB directly, since only the OTP's hash is ever
 * persisted — this is genuine black-box testing of the HTTP surface.
 */
export function spyOnOtpLog(): MockInstance<typeof console.log> {
  return vi.spyOn(console, 'log').mockImplementation(() => undefined);
}

const OTP_LOG_PATTERN = /\[otp:dev] .+ code for (.+): (\d+)$/;

export function lastOtpFor(logSpy: MockInstance<typeof console.log>, identifier: string): string {
  const calls = logSpy.mock.calls as unknown[][];
  for (let i = calls.length - 1; i >= 0; i--) {
    const line = calls[i]?.[0];
    if (typeof line !== 'string') continue;
    const match = OTP_LOG_PATTERN.exec(line);
    if (match && match[1] === identifier && match[2]) {
      return match[2];
    }
  }
  throw new Error(`lastOtpFor: no OTP log found for identifier "${identifier}"`);
}

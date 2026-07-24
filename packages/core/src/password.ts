/**
 * Password hashing — argon2id via @node-rs/argon2 (napi-rs, ships prebuilt
 * binaries per platform, so it needs no C++ toolchain to install). Cost
 * parameters follow the OWASP argon2id baseline for an interactive login path.
 */
import { hash, type Options, verify } from '@node-rs/argon2';

// @node-rs/argon2 declares `Algorithm` as a TS `const enum`, which can't be
// referenced by value under `isolatedModules` (required so esbuild/tsx/
// Turbopack can transpile this file in isolation). Argon2id = 2 per the
// package's own enum definition (Argon2d = 0, Argon2i = 1, Argon2id = 2);
// inlined here rather than importing the enum.
const ARGON2ID_ALGORITHM = 2 as Options['algorithm'];

export const ARGON2ID_OPTIONS: Options = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: 19_456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2ID_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plaintext);
  } catch {
    return false;
  }
}

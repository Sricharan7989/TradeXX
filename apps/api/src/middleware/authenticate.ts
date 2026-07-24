import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

import { tokenExpired, tokenInvalid, unauthorized } from '../lib/http-errors';
import { type AccessTokenPayload, verifyAccessToken } from '../lib/tokens';

declare module 'fastify' {
  interface FastifyRequest {
    // Optional (not every route runs `authenticate`) — routes that require
    // it should call requireUser(request) rather than assuming it's set.
    user?: AccessTokenPayload;
  }
}

/** preHandler for every protected route: verifies the bearer access token, sets request.user. */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing bearer token');
  }

  const token = header.slice('Bearer '.length);
  try {
    request.user = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw tokenExpired();
    throw tokenInvalid();
  }
}

/**
 * Reads request.user without a non-null assertion. Safe to call in any
 * handler registered with `preHandler: authenticate` — throws (rather than
 * silently proceeding with `undefined`) if that invariant is ever violated.
 */
export function requireUser(request: FastifyRequest): AccessTokenPayload {
  if (!request.user) {
    throw unauthorized();
  }
  return request.user;
}

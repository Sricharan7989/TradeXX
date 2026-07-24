import { type NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/kyc'],
};

interface MeResponse {
  user: { status: string };
  profile: { kyc_status: string } | null;
}

/** Copies a Set-Cookie header from the refresh response onto whatever
 *  response middleware ultimately returns. This is not optional: every
 *  refresh call ROTATES the token server-side (old one is revoked), so if
 *  the newly-issued cookie never reaches the browser, the very next request
 *  replays the now-revoked one — the API's reuse-detection then revokes the
 *  entire session. This bit the very first version of this middleware. */
function withRotatedCookie(response: NextResponse, refreshRes: Response): NextResponse {
  const setCookie = refreshRes.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }
  return response;
}

/**
 * Protects /dashboard and /settings/*, redirecting to /kyc if KYC isn't
 * VERIFIED yet. The access token lives in memory on the client only (per
 * spec), so middleware — which only ever sees cookies — re-derives auth
 * state from the httpOnly refresh cookie: exchange it for a short-lived
 * access token, then check /v1/me for kyc_status. Both calls go through the
 * same-origin /api/* rewrite (next.config.mjs) so the SameSite=Strict
 * cookie is actually attached.
 */
export async function middleware(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const origin = request.nextUrl.origin;

  const refreshRes = await fetch(`${origin}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
    body: '{}',
  });

  if (!refreshRes.ok) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    // The presented cookie is invalid/expired/reused — clear it so the
    // browser doesn't keep resending a dead token.
    redirect.cookies.delete('tradex_refresh_token');
    return redirect;
  }

  const { access_token: accessToken } = (await refreshRes.json()) as { access_token: string };

  const isKycPath = request.nextUrl.pathname === '/kyc';
  if (isKycPath) {
    // Already authenticated (refresh succeeded) — no further gating needed
    // to simply view the KYC wizard itself.
    return withRotatedCookie(NextResponse.next(), refreshRes);
  }

  const meRes = await fetch(`${origin}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) {
    return withRotatedCookie(NextResponse.redirect(new URL('/login', request.url)), refreshRes);
  }
  const me = (await meRes.json()) as MeResponse;

  if (me.profile?.kyc_status !== 'VERIFIED') {
    return withRotatedCookie(NextResponse.redirect(new URL('/kyc', request.url)), refreshRes);
  }

  return withRotatedCookie(NextResponse.next(), refreshRes);
}

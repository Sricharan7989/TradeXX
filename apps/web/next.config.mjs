import { fileURLToPath } from 'node:url';

// The browser only ever talks to this same origin (/api/*) — Next.js
// transparently reverse-proxies to the real Fastify API server. This is
// what makes the httpOnly SameSite=Strict refresh-token cookie viable at
// all (SameSite=Strict cookies aren't sent on cross-site requests, so the
// web app and API must appear same-origin to the browser) and is what lets
// middleware.ts read that cookie on ordinary page navigations.
const API_ORIGIN = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// apps/web/next.config.mjs -> repo root is 2 levels up.
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this monorepo — without this, Next.js's
  // auto-detection can pick up an unrelated lockfile in a parent directory
  // outside the repo and warn about it.
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;

/**
 * Security headers, defined once. The API sets API_HEADERS on its responses; the web pages get
 * WEB_HEADERS from vercel.json in production and from the API when it serves the built web app
 * locally. A test keeps vercel.json in sync with this file.
 */

const COMMON: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

export const API_HEADERS: Record<string, string> = {
  ...COMMON,
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Sprite hosts are added here once their use is cleared (see docs/setup.md). */
export const WEB_HEADERS: Record<string, string> = {
  ...COMMON,
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request } from 'express';
import { safeEqual } from '../security/compare.js';

const TTL_MS = 10 * 60 * 1000;

/**
 * OAuth `state` kept in a short-lived httpOnly cookie instead of a server session,
 * so the login works on stateless serverless functions. Follows the store interface of
 * passport-oauth2 (`store(req, meta, cb)` / `verify(req, state, cb)`).
 */
export class CookieStateStore {
  private readonly cookieName: string;

  constructor(private readonly secure: boolean) {
    this.cookieName = secure ? '__Host-vgc_oauth_state' : 'vgc_oauth_state';
  }

  private options(): CookieOptions {
    return { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/' };
  }

  store(
    req: Request,
    _meta: unknown,
    callback: (error: Error | null, state?: string) => void,
  ): void {
    const state = randomBytes(24).toString('base64url');
    req.res?.cookie(this.cookieName, state, { ...this.options(), maxAge: TTL_MS });
    callback(null, state);
  }

  verify(
    req: Request,
    provided: string,
    callback: (error: Error | null, ok: boolean, state?: string) => void,
  ): void {
    const expected: unknown = req.cookies?.[this.cookieName];
    req.res?.clearCookie(this.cookieName, this.options());
    const ok =
      typeof expected === 'string' && typeof provided === 'string' && safeEqual(expected, provided);
    callback(null, ok, ok ? provided : undefined);
  }
}

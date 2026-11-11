import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionUser } from '@vgc-helper/shared';
import { eq, lt } from 'drizzle-orm';
import type { CookieOptions } from 'express';
import type { AppConfig } from '../config/env.js';
import { APP_CONFIG } from '../core/core.module.js';
import { DB, type Db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { safeEqual } from '../security/compare.js';

export interface SessionContext {
  id: string;
  user: SessionUser;
  expiresAt: Date;
}

/** Writes `last_used_at` at most this often, to keep database writes low. */
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get cookieName(): string {
    return this.config.session.cookieName;
  }

  cookieOptions(expiresAt?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
      ...(expiresAt ? { expires: expiresAt } : {}),
    };
  }

  /** Creates a session and returns the token for the cookie. Only the token's hash is stored. */
  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.session.ttlMs);
    await this.db.delete(sessions).where(lt(sessions.expiresAt, now));
    await this.db.insert(sessions).values({
      id: hashToken(token),
      userId,
      createdAt: now,
      expiresAt,
      lastUsedAt: now,
    });
    return { token, expiresAt };
  }

  async validate(token: unknown): Promise<SessionContext | null> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
    const id = hashToken(token);
    const [row] = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, id))
      .limit(1);
    if (!row) return null;

    const now = Date.now();
    if (row.session.expiresAt.getTime() <= now) {
      await this.db.delete(sessions).where(eq(sessions.id, id));
      return null;
    }
    if (now - row.session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.db
        .update(sessions)
        .set({ lastUsedAt: new Date(now) })
        .where(eq(sessions.id, id));
    }
    return {
      id,
      expiresAt: row.session.expiresAt,
      user: { id: row.user.id, login: row.user.login, avatarUrl: row.user.avatarUrl },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /** CSRF token bound to the session. The web app sends it back in a header on writes. */
  csrfToken(sessionId: string): string {
    return createHmac('sha256', this.config.session.secret)
      .update(`csrf:${sessionId}`)
      .digest('base64url');
  }

  verifyCsrf(sessionId: string, provided: unknown): boolean {
    return typeof provided === 'string' && safeEqual(provided, this.csrfToken(sessionId));
  }
}

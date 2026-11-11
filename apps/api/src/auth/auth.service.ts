import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AppConfig } from '../config/env.js';
import { APP_CONFIG } from '../core/core.module.js';
import { DB, type Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { verifyPassword } from '../security/password.js';
import type { GithubIdentity } from './github.strategy.js';

const LOCAL_ADMIN_ID = 'local-admin';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Returns the user id when this GitHub account is on the allowlist.
   * Any other account gets null and nothing is written to the database.
   */
  async authorizeGithub(identity: GithubIdentity): Promise<string | null> {
    const auth = this.config.auth;
    if (auth.mode !== 'github' || !auth.allowedIds.has(identity.id)) {
      this.logger.warn(`Denied GitHub login for id ${identity.id}`);
      return null;
    }

    const now = new Date();
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.githubId, identity.id))
      .limit(1);
    if (existing) {
      await this.db
        .update(users)
        .set({ login: identity.login, avatarUrl: identity.avatarUrl, updatedAt: now })
        .where(eq(users.id, existing.id));
      return existing.id;
    }

    const id = randomUUID();
    await this.db.insert(users).values({
      id,
      githubId: identity.id,
      login: identity.login,
      avatarUrl: identity.avatarUrl,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  /** Returns the local admin's user id when the password matches. */
  async authorizePassword(password: string): Promise<string | null> {
    const auth = this.config.auth;
    if (auth.mode !== 'local-password' || !(await verifyPassword(password, auth.passwordHash))) {
      return null;
    }
    const now = new Date();
    await this.db
      .insert(users)
      .values({
        id: LOCAL_ADMIN_ID,
        login: 'admin',
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    return LOCAL_ADMIN_ID;
  }
}

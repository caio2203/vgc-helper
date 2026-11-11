import { type ExecutionContext, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { type Profile, Strategy } from 'passport-github2';
import type { StateStore } from 'passport-oauth2';
import type { AppConfig } from '../config/env.js';
import { APP_CONFIG } from '../core/core.module.js';
import { CookieStateStore } from './oauth-state.store.js';

export interface GithubIdentity {
  id: string;
  login: string;
  avatarUrl: string | null;
}

function strategyOptions(config: AppConfig) {
  if (config.auth.mode !== 'github') throw new Error('GitHub strategy needs AUTH_MODE=github');
  return {
    clientID: config.auth.clientId,
    clientSecret: config.auth.clientSecret,
    callbackURL: config.auth.callbackUrl,
    // No scope: only the public profile (id, login, avatar) is read.
    scope: [] as string[],
    // passport-oauth2 picks the overload by arity; this store implements the 3-argument form.
    store: new CookieStateStore(config.secureCookies) as unknown as StateStore,
    userAgent: 'vgc-helper',
  };
}

/** Only does the OAuth exchange. Whether the account may enter is decided in AuthService. */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super(strategyOptions(config));
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): GithubIdentity {
    return {
      id: String(profile.id),
      login: profile.username ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}

/** Runs the GitHub OAuth flow. Never throws on a failed login: the controller redirects instead. */
@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    if (this.config.auth.mode !== 'github') throw new NotFoundException();
    return super.canActivate(context);
  }

  override handleRequest<TUser = GithubIdentity>(_error: unknown, user: TUser | false): TUser {
    return (user || null) as TUser;
  }
}

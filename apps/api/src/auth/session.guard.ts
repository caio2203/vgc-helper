import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CSRF_HEADER } from '@vgc-helper/shared';
import type { AppConfig } from '../config/env.js';
import { APP_CONFIG } from '../core/core.module.js';
import { safeEqual } from '../security/compare.js';
import { ACCESS_KEY, type Access, type AuthedRequest } from './access.js';
import { SessionService } from './session.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard: deny by default. A route is reachable without a session only when it is
 * marked @Public() or @CronOnly(). Writes also need the same origin and a valid CSRF token.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return false;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const access = this.reflector.getAllAndOverride<Access | undefined>(ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isWrite = !SAFE_METHODS.has(req.method);

    if (access === 'public') {
      if (isWrite) this.assertSameOrigin(req, true);
      return true;
    }

    if (access === 'cron') {
      const secret = this.config.cronSecret;
      const header = req.header('authorization') ?? '';
      if (!secret || !safeEqual(header, `Bearer ${secret}`)) throw new UnauthorizedException();
      return true;
    }

    const session = await this.sessions.validate(req.cookies?.[this.sessions.cookieName]);
    if (!session) throw new UnauthorizedException();

    if (isWrite) {
      this.assertSameOrigin(req, false);
      if (!this.sessions.verifyCsrf(session.id, req.header(CSRF_HEADER))) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }
    req.auth = session;
    return true;
  }

  /** Browsers always send Origin on writes. Without a session, it is required. */
  private assertSameOrigin(req: AuthedRequest, requireOrigin: boolean): void {
    const origin = req.header('origin');
    if (origin === undefined ? requireOrigin : !this.config.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Cross-origin request blocked');
    }
    const site = req.header('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') {
      throw new ForbiddenException('Cross-site request blocked');
    }
  }
}

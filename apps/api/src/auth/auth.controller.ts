import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  type AuthMethods,
  type LocalLoginRequest,
  type LoginError,
  localLoginRequestSchema,
  type SessionResponse,
} from '@vgc-helper/shared';
import type { Response } from 'express';
import type { AppConfig } from '../config/env.js';
import { APP_CONFIG } from '../core/core.module.js';
import { ZodPipe } from '../core/zod.pipe.js';
import { RateLimit } from '../security/rate-limit.js';
import { type AuthedRequest, CurrentSession, Public } from './access.js';
import { AuthService } from './auth.service.js';
import { GithubAuthGuard, type GithubIdentity } from './github.strategy.js';
import { type SessionContext, SessionService } from './session.service.js';

const GITHUB_LOGIN_LIMIT = { limit: 10, windowMs: 60_000 };
const PASSWORD_LOGIN_LIMIT = { limit: 5, windowMs: 60_000 };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Tells the login screen which button to show. Reveals nothing else. */
  @Public()
  @Get('methods')
  methods(): AuthMethods {
    return { mode: this.config.auth.mode };
  }

  @Get('session')
  session(@CurrentSession() session: SessionContext): SessionResponse {
    return { user: session.user, csrfToken: this.sessions.csrfToken(session.id) };
  }

  @Public()
  @RateLimit(GITHUB_LOGIN_LIMIT)
  @UseGuards(GithubAuthGuard)
  @Get('github')
  githubStart(): void {
    // The guard redirects to GitHub.
  }

  @Public()
  @RateLimit(GITHUB_LOGIN_LIMIT)
  @UseGuards(GithubAuthGuard)
  @Get('github/callback')
  async githubCallback(@Req() req: AuthedRequest, @Res() res: Response): Promise<void> {
    const identity = req.user as GithubIdentity | null | undefined;
    if (!identity) return this.redirectToLogin(res, 'oauth_failed');

    const userId = await this.auth.authorizeGithub(identity);
    if (!userId) return this.redirectToLogin(res, 'access_denied');

    await this.startSession(res, userId);
    res.redirect(303, `${this.config.appOrigin}/`);
  }

  @Public()
  @RateLimit(PASSWORD_LOGIN_LIMIT)
  @Post('login')
  @HttpCode(204)
  async login(
    @Body(new ZodPipe(localLoginRequestSchema)) body: LocalLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (this.config.auth.mode !== 'local-password') throw new NotFoundException();
    const userId = await this.auth.authorizePassword(body.password);
    if (!userId)
      throw new UnauthorizedException({ error: 'invalid_credentials' satisfies LoginError });
    await this.startSession(res, userId);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revoke(session.id);
    res.clearCookie(this.sessions.cookieName, this.sessions.cookieOptions());
  }

  private async startSession(res: Response, userId: string): Promise<void> {
    const { token, expiresAt } = await this.sessions.create(userId);
    res.cookie(this.sessions.cookieName, token, this.sessions.cookieOptions(expiresAt));
  }

  private redirectToLogin(res: Response, error: LoginError): void {
    res.redirect(303, `${this.config.appOrigin}/login?error=${error}`);
  }
}

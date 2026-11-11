import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContext } from './session.service.js';

export const ACCESS_KEY = 'vgc:access';
export type Access = 'public' | 'cron';

/**
 * Every route needs a valid session by default. These two decorators are the only way out,
 * and the CI route test fails if a route uses them without being on its allowlist.
 */
export const Public = () => SetMetadata(ACCESS_KEY, 'public' satisfies Access);
/** Only reachable with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it). */
export const CronOnly = () => SetMetadata(ACCESS_KEY, 'cron' satisfies Access);

export interface AuthedRequest extends Request {
  auth?: SessionContext;
}

export const CurrentSession = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const session = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
  if (!session) throw new Error('CurrentSession used on a route without a session');
  return session;
});

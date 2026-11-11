import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_KEY = 'vgc:rate-limit';
/** Applies to every route without its own rule. */
export const DEFAULT_RATE_LIMIT: RateLimitRule = { limit: 120, windowMs: 60_000 };
/** Above this many tracked keys, expired entries are swept on the next request. */
const SWEEP_THRESHOLD = 5_000;

/** Overrides the default limit for one route or controller. */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

/**
 * Fixed-window rate limit per client IP and route, kept in memory. On serverless functions each
 * instance counts on its own; Vercel Authentication in front of the app stops strangers first.
 * (Written in-house because @nestjs/throttler is CommonJS and cannot load the ESM-only Nest 12
 * packages on Vercel's function runtime.)
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const rule =
      this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMIT;
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const now = Date.now();
    if (this.windows.size > SWEEP_THRESHOLD) this.sweep(now);

    const key = `${req.ip ?? 'unknown'}|${context.getClass().name}.${context.getHandler().name}`;
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + rule.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;

    if (window.count > rule.limit) {
      res.setHeader('Retry-After', String(Math.ceil((window.resetAt - now) / 1000)));
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

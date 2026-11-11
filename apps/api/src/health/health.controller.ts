import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@vgc-helper/shared';
import { sql } from 'drizzle-orm';
import { CronOnly, Public } from '../auth/access.js';
import { DB, type Db } from '../db/client.js';

@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Liveness only. Says nothing about the instance, its data or its configuration. */
  @Public()
  @Get('health')
  health(): HealthResponse {
    return { status: 'ok' };
  }

  /** Daily Vercel Cron call. A read keeps the free Turso database from being archived for inactivity. */
  @CronOnly()
  @Get('internal/keepalive')
  async keepalive(): Promise<HealthResponse> {
    await this.db.run(sql`select 1`);
    return { status: 'ok' };
  }
}

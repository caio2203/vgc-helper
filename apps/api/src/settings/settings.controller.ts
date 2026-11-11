import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import {
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsPatch,
  settingsPatchSchema,
  settingsSchema,
} from '@vgc-helper/shared';
import { eq } from 'drizzle-orm';
import { CurrentSession } from '../auth/access.js';
import type { SessionContext } from '../auth/session.service.js';
import { ZodPipe } from '../core/zod.pipe.js';
import { DB, type Db } from '../db/client.js';
import { userSettings } from '../db/schema.js';

@Controller('settings')
export class SettingsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async get(@CurrentSession() session: SessionContext): Promise<Settings> {
    return this.read(session.user.id);
  }

  @Patch()
  async update(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(settingsPatchSchema)) patch: SettingsPatch,
  ): Promise<Settings> {
    const next = settingsSchema.parse({ ...(await this.read(session.user.id)), ...patch });
    const now = new Date();
    await this.db
      .insert(userSettings)
      .values({ userId: session.user.id, data: next, updatedAt: now })
      .onConflictDoUpdate({ target: userSettings.userId, set: { data: next, updatedAt: now } });
    return next;
  }

  private async read(userId: string): Promise<Settings> {
    const [row] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    // Unknown or outdated stored values fall back to the defaults instead of breaking the app.
    const merged = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...row?.data });
    return merged.success ? merged.data : DEFAULT_SETTINGS;
  }
}

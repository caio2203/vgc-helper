import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiController } from './ai/ai.controller.js';
import { AiService } from './ai/ai.service.js';
import { GeminiProvider } from './ai/gemini.provider.js';
import { LLM_PROVIDER, type LlmProvider } from './ai/llm.js';
import { AuthModule } from './auth/auth.module.js';
import { SessionGuard } from './auth/session.guard.js';
import type { AppConfig } from './config/env.js';
import { CoreModule } from './core/core.module.js';
import type { Db } from './db/client.js';
import { FeedbackController } from './feedback/feedback.controller.js';
import { HealthController } from './health/health.controller.js';
import { RateLimitGuard } from './security/rate-limit.js';
import { SettingsController } from './settings/settings.controller.js';
import { SnapshotsController } from './snapshots/snapshots.controller.js';
import { SnapshotsService } from './snapshots/snapshots.service.js';
import { TeamsController } from './teams/teams.controller.js';
import { TeamsService } from './teams/teams.service.js';

@Module({})
export class AppModule {
  /** `llm` replaces the provider in tests; otherwise Gemini when GEMINI_API_KEY is set. */
  static forRoot(config: AppConfig, db: Db, llm?: LlmProvider | null): DynamicModule {
    const provider =
      llm !== undefined
        ? llm
        : config.ai.apiKey
          ? new GeminiProvider(config.ai.apiKey, config.ai.model, config.ai.fallbackModel)
          : null;
    return {
      module: AppModule,
      imports: [CoreModule.forRoot(config, db), AuthModule.forRoot(config)],
      controllers: [
        AiController,
        FeedbackController,
        HealthController,
        SettingsController,
        SnapshotsController,
        TeamsController,
      ],
      providers: [
        { provide: LLM_PROVIDER, useValue: provider },
        AiService,
        SnapshotsService,
        TeamsService,
        // Order matters: rate limit first, then the deny-by-default session check.
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
    };
  }
}

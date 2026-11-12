import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  type AiAnswer,
  type AiChatInput,
  type AiExplainInput,
  type AiStatus,
  aiChatSchema,
  aiExplainSchema,
} from '@vgc-helper/shared';
import { CurrentSession } from '../auth/access.js';
import type { SessionContext } from '../auth/session.service.js';
import { ZodPipe } from '../core/zod.pipe.js';
import { RateLimit } from '../security/rate-limit.js';
import { AiService } from './ai.service.js';

/** Calls that reach the model: a few per minute, on top of the daily limit in the service. */
const AI_RATE_LIMIT = { limit: 6, windowMs: 60_000 };

/** On-demand AI. Every route needs a session, like the rest of the API. */
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status(): AiStatus {
    return this.ai.status();
  }

  @Post('explain')
  @HttpCode(200)
  @RateLimit(AI_RATE_LIMIT)
  explain(
    @CurrentSession() s: SessionContext,
    @Body(new ZodPipe(aiExplainSchema)) input: AiExplainInput,
  ): Promise<AiAnswer> {
    return this.ai.explain(s.user.id, input);
  }

  @Post('chat')
  @HttpCode(200)
  @RateLimit(AI_RATE_LIMIT)
  chat(
    @CurrentSession() s: SessionContext,
    @Body(new ZodPipe(aiChatSchema)) input: AiChatInput,
  ): Promise<AiAnswer> {
    return this.ai.chat(s.user.id, input);
  }
}

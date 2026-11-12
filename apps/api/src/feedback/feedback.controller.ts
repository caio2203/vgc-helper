import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { type FeedbackInput, type FeedbackSummary, feedbackInputSchema } from '@vgc-helper/shared';
import { eq } from 'drizzle-orm';
import { CurrentSession } from '../auth/access.js';
import type { SessionContext } from '../auth/session.service.js';
import { ZodPipe } from '../core/zod.pipe.js';
import { DB, type Db } from '../db/client.js';
import { suggestionFeedback } from '../db/schema.js';

@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post()
  @HttpCode(201)
  async create(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(feedbackInputSchema)) input: FeedbackInput,
  ): Promise<{ id: string }> {
    const id = randomUUID();
    await this.db.insert(suggestionFeedback).values({
      id,
      userId: session.user.id,
      subject: input.subject,
      helpful: input.helpful,
      gameId: input.gameId,
      formatId: input.formatId,
      regulationId: input.regulationId,
      snapshotVersion: input.snapshotVersion,
      score: Math.round(input.score * 100),
      rank: input.rank,
      experienceLevel: input.experienceLevel,
      team: input.team,
      createdAt: new Date(),
    });
    return { id };
  }

  /** What the owner rated, per suggested species. */
  @Get('summary')
  async summary(@CurrentSession() session: SessionContext): Promise<FeedbackSummary> {
    const rows = await this.db
      .select({ subject: suggestionFeedback.subject, helpful: suggestionFeedback.helpful })
      .from(suggestionFeedback)
      .where(eq(suggestionFeedback.userId, session.user.id));
    const bySubject = new Map<string, { helpful: number; notHelpful: number }>();
    for (const row of rows) {
      const entry = bySubject.get(row.subject) ?? { helpful: 0, notHelpful: 0 };
      if (row.helpful) entry.helpful += 1;
      else entry.notHelpful += 1;
      bySubject.set(row.subject, entry);
    }
    return {
      total: rows.length,
      helpful: rows.filter((r) => r.helpful).length,
      bySubject: [...bySubject]
        .map(([subject, counts]) => ({ subject, ...counts }))
        .sort((a, b) => b.helpful + b.notHelpful - (a.helpful + a.notHelpful)),
    };
  }
}

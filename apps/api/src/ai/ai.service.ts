import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { MetaSnapshot } from '@vgc-helper/data';
import { analysisRulesFor, type DexIndex, indexDex, type RulesContext } from '@vgc-helper/engine';
import { commonSetTool, legalityTool, summarizeTeam, usageTool } from '@vgc-helper/engine/damage';
import type {
  AiAnswer,
  AiChatInput,
  AiErrorReason,
  AiExplainInput,
  AiStatus,
  AiTeam,
} from '@vgc-helper/shared';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import type { AppConfig } from '../config/env.js';
import { APP_CONFIG } from '../core/core.module.js';
import { DB, type Db } from '../db/client.js';
import { aiResponses } from '../db/schema.js';
import { SnapshotsService } from '../snapshots/snapshots.service.js';
import { LLM_PROVIDER, type LlmProvider, type LlmTool, LlmUnavailableError } from './llm.js';
import { systemPrompt } from './prompts.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type Kind = 'explain' | 'chat';

function fail(status: HttpStatus, reason: AiErrorReason): never {
  throw new HttpException({ reason }, status);
}

const TOOLS: LlmTool[] = [
  {
    name: 'getUsage',
    description:
      'Usage share and rank of one Pokémon in the format, from the usage data of the snapshot.',
    parameters: {
      type: 'object',
      properties: { species: { type: 'string', description: 'Pokémon name, e.g. Incineroar' } },
      required: ['species'],
    },
  },
  {
    name: 'getCommonSet',
    description:
      'The most common items, abilities, moves, spreads and teammates of one Pokémon, with shares.',
    parameters: {
      type: 'object',
      properties: { species: { type: 'string' } },
      required: ['species'],
    },
  },
  {
    name: 'checkLegality',
    description:
      'Whether a Pokémon, and optionally its moves, item and ability, are legal in the regulation.',
    parameters: {
      type: 'object',
      properties: {
        species: { type: 'string' },
        moves: { type: 'array', items: { type: 'string' } },
        item: { type: 'string' },
        ability: { type: 'string' },
      },
      required: ['species'],
    },
  },
];

const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 60) : '');

/**
 * On-demand explanations and chat about a team. The API runs the engine on the team and gives
 * the model only that analysis plus tools over the snapshot. Answers are cached per team, data
 * version, language and level; a daily limit protects the free quota.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly indexes = new Map<string, Promise<DexIndex>>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly db: Db,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider | null,
    private readonly snapshots: SnapshotsService,
  ) {}

  status(): AiStatus {
    return { enabled: this.llm !== null, model: this.llm?.model ?? null };
  }

  explain(userId: string, input: AiExplainInput): Promise<AiAnswer> {
    return this.answer(userId, 'explain', input, [
      { role: 'user', text: 'Explain this analysis.' },
    ]);
  }

  chat(userId: string, input: AiChatInput): Promise<AiAnswer> {
    return this.answer(userId, 'chat', input, input.messages);
  }

  private async answer(
    userId: string,
    kind: Kind,
    input: AiExplainInput,
    messages: AiChatInput['messages'],
  ): Promise<AiAnswer> {
    const llm = this.llm;
    if (!llm) fail(HttpStatus.SERVICE_UNAVAILABLE, 'disabled');

    const { ctx, index, meta, version } = await this.rules(input.team);
    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify({
          kind,
          team: input.team,
          version,
          locale: input.locale,
          level: input.level,
          model: llm.model,
          messages,
        }),
      )
      .digest('hex');

    const [hit] = await this.db
      .select()
      .from(aiResponses)
      .where(and(eq(aiResponses.userId, userId), eq(aiResponses.cacheKey, cacheKey)))
      .orderBy(desc(aiResponses.createdAt))
      .limit(1);
    if (hit) {
      return {
        text: hit.text,
        model: hit.model,
        cached: true,
        createdAt: hit.createdAt.toISOString(),
      };
    }

    const [used] = await this.db
      .select({ n: count() })
      .from(aiResponses)
      .where(
        and(
          eq(aiResponses.userId, userId),
          gt(aiResponses.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      );
    if ((used?.n ?? 0) >= this.config.ai.dailyLimit) {
      fail(HttpStatus.TOO_MANY_REQUESTS, 'dailyLimit');
    }

    const rules = analysisRulesFor(await this.snapshots.manifest(), ctx.regulation.gameId);
    if (!rules) throw new BadRequestException('No analysis rules for this game');
    const analysis = summarizeTeam(input.team.slots, ctx, index, rules, meta, {
      cutoff: ctx.format.viability.defaultCutoff,
      offMeta: false,
    });

    let text: string;
    try {
      text = await llm.generate({
        system: systemPrompt(kind, input.locale, input.level, analysis),
        messages,
        tools: TOOLS,
        callTool: (name, args) => {
          if (name === 'getUsage') return usageTool(meta, index, str(args.species));
          if (name === 'getCommonSet') return commonSetTool(meta, index, str(args.species));
          if (name === 'checkLegality') {
            return legalityTool(ctx, index, {
              species: str(args.species),
              moves: Array.isArray(args.moves) ? args.moves.slice(0, 4).map(str) : [],
              item: str(args.item) || undefined,
              ability: str(args.ability) || undefined,
            });
          }
          return { error: `Unknown tool ${name}` };
        },
      });
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        this.logger.warn(`AI ${kind} failed (${error.reason})`);
        fail(
          error.reason === 'quota' ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.SERVICE_UNAVAILABLE,
          error.reason,
        );
      }
      throw new ServiceUnavailableException({ reason: 'unavailable' });
    }

    const createdAt = new Date();
    await this.db.insert(aiResponses).values({
      id: randomUUID(),
      userId,
      cacheKey,
      kind,
      model: llm.model,
      snapshotVersion: version,
      text,
      createdAt,
    });
    return { text, model: llm.model, cached: false, createdAt: createdAt.toISOString() };
  }

  /** The rules of the team's regulation and format, from the snapshot the API serves. */
  private async rules(team: AiTeam): Promise<{
    ctx: RulesContext;
    index: DexIndex;
    meta: MetaSnapshot | null;
    version: string;
  }> {
    const manifest = await this.snapshots.manifest();
    const regulation = manifest.regulations.find(
      (r) => r.gameId === team.gameId && r.id === team.regulationId,
    );
    const format = manifest.formats.find((f) => f.id === team.formatId);
    const game = manifest.games.find((g) => g.id === team.gameId);
    const profile = manifest.mechanicsProfiles.find((p) => p.id === game?.mechanicsProfileId);
    if (
      !regulation ||
      !format ||
      !profile ||
      !regulation.formats.some((f) => f.formatId === format.id)
    ) {
      throw new BadRequestException('Unknown game, format or regulation');
    }
    const dex = await this.snapshots.dex(team.gameId, team.regulationId);
    const key = `${team.gameId}/${team.regulationId}`;
    let index = this.indexes.get(key);
    if (!index) {
      index = Promise.resolve(indexDex(dex));
      this.indexes.set(key, index);
    }
    const meta = regulation.files.meta[format.id]
      ? await this.snapshots.meta(team.gameId, team.regulationId, format.id)
      : null;
    return {
      ctx: { dex, regulation, format, profile },
      index: await index,
      meta,
      version: manifest.version,
    };
  }
}

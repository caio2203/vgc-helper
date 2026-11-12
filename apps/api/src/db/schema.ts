import type { Settings, TeamInput, TeamSlot } from '@vgc-helper/shared';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull();
const updatedAt = () => integer('updated_at', { mode: 'timestamp_ms' }).notNull();

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  /** Numeric GitHub id. Null for the local-password admin. */
  githubId: text('github_id').unique(),
  login: text('login').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 of the cookie token. The token itself is never stored. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: text('data', { mode: 'json' }).$type<Partial<Settings>>().notNull(),
  updatedAt: updatedAt(),
});

export const teams = sqliteTable(
  'teams',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    gameId: text('game_id').notNull(),
    formatId: text('format_id').notNull(),
    regulationId: text('regulation_id').notNull(),
    /** Snapshot the team was last saved against, used to revalidate it when data changes. */
    snapshotVersion: text('snapshot_version').notNull(),
    slots: text('slots', { mode: 'json' }).$type<TeamSlot[]>().notNull(),
    notes: text('notes').notNull().default(''),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('teams_user_idx').on(t.userId)],
);

export const teamVersions = sqliteTable(
  'team_versions',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    snapshotVersion: text('snapshot_version').notNull(),
    data: text('data', { mode: 'json' }).$type<TeamInput>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('team_versions_team_version_idx').on(t.teamId, t.version)],
);

/** "Useful / not useful" on suggestions, so the owner can see which ones work. */
export const suggestionFeedback = sqliteTable(
  'suggestion_feedback',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    helpful: integer('helpful', { mode: 'boolean' }).notNull(),
    gameId: text('game_id').notNull(),
    formatId: text('format_id').notNull(),
    regulationId: text('regulation_id').notNull(),
    snapshotVersion: text('snapshot_version').notNull(),
    score: integer('score_x100').notNull(),
    rank: integer('rank').notNull(),
    experienceLevel: text('experience_level').notNull(),
    team: text('team', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('suggestion_feedback_user_idx').on(t.userId)],
);

/**
 * AI answers, kept so the same question about the same team, data version, language and level
 * is answered from here instead of spending the free quota again. Also counts the daily limit.
 */
export const aiResponses = sqliteTable(
  'ai_responses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the request: kind, team, snapshot version, language, level, model, messages. */
    cacheKey: text('cache_key').notNull(),
    kind: text('kind', { enum: ['explain', 'chat'] }).notNull(),
    model: text('model').notNull(),
    snapshotVersion: text('snapshot_version').notNull(),
    text: text('text').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ai_responses_user_key_idx').on(t.userId, t.cacheKey),
    index('ai_responses_user_created_idx').on(t.userId, t.createdAt),
  ],
);

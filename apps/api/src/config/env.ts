import { z } from 'zod';
import { parsePasswordHash } from '../security/password.js';

/** The newest Flash model with a free tier when this was written; GEMINI_MODEL overrides it. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const flag = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  // Hostnames Vercel injects at runtime (no protocol).
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.url().optional(),
  AUTH_MODE: z.enum(['github', 'local-password']).optional(),
  SESSION_SECRET: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  AUTH_ALLOWED_GITHUB_IDS: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  DATABASE_URL: z.string().default('file:local.db'),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  TRUST_PROXY: flag.optional(),
  MIGRATE_ON_BOOT: flag.optional(),
  SERVE_WEB_DIR: z.string().optional(),
  // Optional: without a key the AI features stay hidden and everything else works.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default(DEFAULT_GEMINI_MODEL),
  AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(50),
});

export type AuthConfig =
  | {
      mode: 'github';
      clientId: string;
      clientSecret: string;
      /** Numeric GitHub user ids. Usernames can change, ids cannot. */
      allowedIds: ReadonlySet<string>;
      callbackUrl: string;
    }
  | { mode: 'local-password'; passwordHash: string };

export interface DatabaseConfig {
  url: string;
  authToken?: string;
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  /** Canonical origin: OAuth callback and redirects after login. */
  appOrigin: string;
  /** Origins allowed to send writes: the app origin plus this deployment's own Vercel URLs. */
  allowedOrigins: ReadonlySet<string>;
  secureCookies: boolean;
  session: { secret: string; ttlMs: number; cookieName: string };
  auth: AuthConfig;
  database: DatabaseConfig;
  cronSecret: string | null;
  trustProxy: boolean;
  migrateOnBoot: boolean;
  serveWebDir: string | null;
  /** `apiKey` null: the AI routes answer `disabled` and the web app hides the AI features. */
  ai: { apiKey: string | null; model: string; dailyLimit: number };
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const MIN_SECRET_LENGTH = 32;

/** `KEY=` lines in .env files arrive as empty strings; treat them as unset. */
function withoutEmpty(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const e = envSchema.parse(withoutEmpty(env));
  if (e.TURSO_DATABASE_URL) {
    return {
      url: e.TURSO_DATABASE_URL,
      ...(e.TURSO_AUTH_TOKEN ? { authToken: e.TURSO_AUTH_TOKEN } : {}),
    };
  }
  return { url: e.DATABASE_URL };
}

/**
 * Reads and checks the environment. Fails closed: if authentication is not fully configured,
 * the API refuses to start instead of starting unprotected.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(withoutEmpty(env));
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid environment: ${details}`);
  }
  const e = parsed.data;
  const onVercel = e.VERCEL === '1';
  const problems: string[] = [];

  // On Vercel each preview has its own URL, so the origin can come from Vercel's own variables.
  const https = (host: string | undefined) => (host ? `https://${host}` : null);
  const vercelOrigin = onVercel
    ? e.VERCEL_ENV === 'production'
      ? https(e.VERCEL_PROJECT_PRODUCTION_URL)
      : (https(e.VERCEL_BRANCH_URL) ?? https(e.VERCEL_URL))
    : null;
  const appOrigin = e.APP_ORIGIN ? new URL(e.APP_ORIGIN).origin : vercelOrigin;
  if (!appOrigin) problems.push('APP_ORIGIN is required (for example http://localhost:5173)');

  const allowedOrigins = new Set(
    [
      appOrigin,
      ...(onVercel
        ? [https(e.VERCEL_URL), https(e.VERCEL_BRANCH_URL), https(e.VERCEL_PROJECT_PRODUCTION_URL)]
        : []),
    ].filter((origin): origin is string => origin !== null),
  );

  const secret = e.SESSION_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`SESSION_SECRET must have at least ${MIN_SECRET_LENGTH} characters`);
  }

  let auth: AuthConfig | null = null;
  if (e.AUTH_MODE === 'github') {
    const ids = (e.AUTH_ALLOWED_GITHUB_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!e.GITHUB_CLIENT_ID) problems.push('GITHUB_CLIENT_ID is required when AUTH_MODE=github');
    if (!e.GITHUB_CLIENT_SECRET)
      problems.push('GITHUB_CLIENT_SECRET is required when AUTH_MODE=github');
    if (ids.length === 0)
      problems.push('AUTH_ALLOWED_GITHUB_IDS needs at least one numeric GitHub id');
    if (ids.some((id) => !/^\d+$/.test(id))) {
      problems.push('AUTH_ALLOWED_GITHUB_IDS must hold numeric GitHub ids, not usernames');
    }
    if (e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET && appOrigin) {
      auth = {
        mode: 'github',
        clientId: e.GITHUB_CLIENT_ID,
        clientSecret: e.GITHUB_CLIENT_SECRET,
        allowedIds: new Set(ids),
        callbackUrl: `${appOrigin}/api/auth/github/callback`,
      };
    }
  } else if (e.AUTH_MODE === 'local-password') {
    if (!e.ADMIN_PASSWORD_HASH || !parsePasswordHash(e.ADMIN_PASSWORD_HASH)) {
      problems.push(
        'ADMIN_PASSWORD_HASH is missing or invalid. Generate it with `pnpm hash-password`',
      );
    } else {
      auth = { mode: 'local-password', passwordHash: e.ADMIN_PASSWORD_HASH };
    }
  } else {
    problems.push('AUTH_MODE is required: github or local-password');
  }

  const database = loadDatabaseConfig(env);
  if (onVercel && !/^(libsql|https|wss?):\/\//.test(database.url)) {
    problems.push('The Vercel disk is temporary. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  }

  if (problems.length > 0 || !auth || !appOrigin) {
    throw new ConfigError(`Refusing to start:\n- ${problems.join('\n- ')}`);
  }

  const secureCookies = appOrigin.startsWith('https://');
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    appOrigin,
    allowedOrigins,
    secureCookies,
    session: {
      secret,
      ttlMs: e.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      // The __Host- prefix pins the cookie to this exact host over HTTPS.
      cookieName: secureCookies ? '__Host-vgc_session' : 'vgc_session',
    },
    auth,
    database,
    cronSecret: e.CRON_SECRET && e.CRON_SECRET.length >= 16 ? e.CRON_SECRET : null,
    trustProxy: e.TRUST_PROXY ?? onVercel,
    migrateOnBoot: e.MIGRATE_ON_BOOT ?? database.url.startsWith('file:'),
    serveWebDir: e.SERVE_WEB_DIR ?? null,
    ai: { apiKey: e.GEMINI_API_KEY ?? null, model: e.GEMINI_MODEL, dailyLimit: e.AI_DAILY_LIMIT },
  };
}

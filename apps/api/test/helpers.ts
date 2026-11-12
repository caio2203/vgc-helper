import type { NestExpressApplication } from '@nestjs/platform-express';
import { CSRF_HEADER } from '@vgc-helper/shared';
import request from 'supertest';
import { createApp } from '../src/app.factory.js';
import { loadConfig } from '../src/config/env.js';
import { hashPassword } from '../src/security/password.js';

export const TEST_ORIGIN = 'http://localhost:5173';
export const TEST_PASSWORD = 'correct horse battery staple';
export const TEST_CRON_SECRET = 'cron-secret-used-only-in-tests';

let passwordHash: Promise<string> | undefined;

export async function testEnv(overrides: NodeJS.ProcessEnv = {}): Promise<NodeJS.ProcessEnv> {
  passwordHash ??= hashPassword(TEST_PASSWORD);
  return {
    NODE_ENV: 'test',
    APP_ORIGIN: TEST_ORIGIN,
    SESSION_SECRET: 'test-session-secret-that-is-long-enough',
    AUTH_MODE: 'local-password',
    ADMIN_PASSWORD_HASH: await passwordHash,
    CRON_SECRET: TEST_CRON_SECRET,
    DATABASE_URL: ':memory:',
    MIGRATE_ON_BOOT: 'true',
    ...overrides,
  };
}

export const GITHUB_ENV: NodeJS.ProcessEnv = {
  AUTH_MODE: 'github',
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  AUTH_ALLOWED_GITHUB_IDS: '1001',
};

export async function createTestApp(
  overrides: NodeJS.ProcessEnv = {},
): Promise<NestExpressApplication> {
  return createApp(loadConfig(await testEnv(overrides)));
}

export interface RouteInfo {
  method: string;
  path: string;
}

/** Every route registered on the Express app, read from its router. */
export function listRoutes(app: NestExpressApplication): RouteInfo[] {
  const express = app.getHttpAdapter().getInstance() as {
    router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] };
  };
  return express.router.stack.flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods)
          .filter((m) => m !== '_all')
          .map((m) => ({ method: m.toUpperCase(), path: layer.route?.path ?? '' }))
      : [],
  );
}

/** The `name=value` part of a Set-Cookie header. */
export function cookieFrom(setCookie: string[] | string | undefined, name: string): string {
  const all = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = all.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`Cookie ${name} not set`);
  return found.split(';')[0] as string;
}

/** Logs in with the test password; returns the headers an authenticated write needs. */
export async function signIn(app: NestExpressApplication): Promise<Record<string, string>> {
  const http = app.getHttpServer();
  const login = await request(http)
    .post('/api/auth/login')
    .set('Origin', TEST_ORIGIN)
    .send({ password: TEST_PASSWORD });
  const cookie = cookieFrom(login.headers['set-cookie'], 'vgc_session');
  const session = await request(http).get('/api/auth/session').set('Cookie', cookie);
  return { Cookie: cookie, Origin: TEST_ORIGIN, [CSRF_HEADER]: session.body.csrfToken };
}

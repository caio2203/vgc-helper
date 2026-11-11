import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, GITHUB_ENV, listRoutes } from './helpers.js';

/**
 * The only routes that may answer without a session. Adding a route here is a security
 * decision: it must be reviewed, and docs/security.md must say why.
 */
const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'GET /api/auth/methods',
  'GET /api/auth/github',
  'GET /api/auth/github/callback',
  'POST /api/auth/login',
]);

describe.each([
  ['github', GITHUB_ENV],
  ['local-password', {}],
])('every route without a session (%s login)', (_mode, env) => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp(env);
  });
  afterAll(async () => {
    await app.close();
  });

  it('finds the routes to test', () => {
    expect(listRoutes(app).length).toBeGreaterThan(PUBLIC_ROUTES.size);
  });

  it('answers 401 unless the route is on the public allowlist', async () => {
    const leaks: string[] = [];
    for (const route of listRoutes(app)) {
      const key = `${route.method} ${route.path}`;
      if (PUBLIC_ROUTES.has(key)) continue;

      const url = route.path.replace(/:\w+/g, 'x');
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const response = await request(app.getHttpServer())[method](url).send({});
      if (response.status !== 401) leaks.push(`${key} answered ${response.status}`);
    }
    expect(leaks).toEqual([]);
  });

  it('keeps the public routes from leaking data', async () => {
    const health = await request(app.getHttpServer()).get('/api/health');
    expect(health.body).toEqual({ status: 'ok' });
  });
});

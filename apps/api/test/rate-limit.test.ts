import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TEST_ORIGIN } from './helpers.js';

describe('rate limit', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('allows 5 password attempts per minute and then answers 429 with Retry-After', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', TEST_ORIGIN)
        .send({ password: 'wrong password' });

    for (let i = 0; i < 5; i += 1) expect((await attempt()).status).toBe(401);

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts each route separately', async () => {
    const health = await request(app.getHttpServer()).get('/api/health');
    expect(health.status).toBe(200);
  });
});

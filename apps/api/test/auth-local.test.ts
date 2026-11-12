import type { NestExpressApplication } from '@nestjs/platform-express';
import { CSRF_HEADER } from '@vgc-helper/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cookieFrom,
  createTestApp,
  TEST_CRON_SECRET,
  TEST_ORIGIN,
  TEST_PASSWORD,
} from './helpers.js';

describe('local-password login, CSRF and logout', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let cookie: string;
  let csrf: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
  });
  afterAll(async () => {
    await app.close();
  });

  it('reports the login method', async () => {
    const res = await request(http).get('/api/auth/methods');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: 'local-password' });
  });

  it('rejects a login without Origin or from another origin', async () => {
    const noOrigin = await request(http).post('/api/auth/login').send({ password: TEST_PASSWORD });
    expect(noOrigin.status).toBe(403);
    const evil = await request(http)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ password: TEST_PASSWORD });
    expect(evil.status).toBe(403);
  });

  it('rejects a wrong password without creating a session', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ password: 'wrong password' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('logs in with an httpOnly, SameSite=Lax session cookie', async () => {
    const res = await request(http)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ password: TEST_PASSWORD });
    expect(res.status).toBe(204);
    const raw = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/SameSite=Lax/);
    cookie = cookieFrom(res.headers['set-cookie'], 'vgc_session');
  });

  it('returns the session with a CSRF token', async () => {
    const res = await request(http).get('/api/auth/session').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.login).toBe('admin');
    expect(typeof res.body.csrfToken).toBe('string');
    csrf = res.body.csrfToken;
  });

  it('blocks writes without the CSRF token or from another origin', async () => {
    const noToken = await request(http)
      .patch('/api/settings')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
      .send({ locale: 'pt-BR' });
    expect(noToken.status).toBe(403);

    const wrongOrigin = await request(http)
      .patch('/api/settings')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .set(CSRF_HEADER, csrf)
      .send({ locale: 'pt-BR' });
    expect(wrongOrigin.status).toBe(403);
  });

  it('saves settings with the CSRF token and validates the body', async () => {
    const ok = await request(http)
      .patch('/api/settings')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
      .set(CSRF_HEADER, csrf)
      .send({ locale: 'pt-BR', experienceLevel: 'advanced' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      locale: 'pt-BR',
      experienceLevel: 'advanced',
      density: 'comfortable',
    });

    const bad = await request(http)
      .patch('/api/settings')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
      .set(CSRF_HEADER, csrf)
      .send({ locale: 'xx' });
    expect(bad.status).toBe(400);

    const read = await request(http).get('/api/settings').set('Cookie', cookie);
    expect(read.body.locale).toBe('pt-BR');
  });

  it('serves snapshots only to the logged-in user', async () => {
    const manifest = await request(http).get('/api/snapshots/manifest').set('Cookie', cookie);
    expect(manifest.status).toBe(200);
    const regulation = manifest.body.regulations[0];

    const dex = await request(http)
      .get(`/api/snapshots/${regulation.gameId}/${regulation.id}/dex`)
      .set('Cookie', cookie);
    expect(dex.status).toBe(200);
    expect(dex.body.species.length).toBeGreaterThan(100);

    const missing = await request(http)
      .get('/api/snapshots/champions/NOPE/dex')
      .set('Cookie', cookie);
    expect(missing.status).toBe(404);

    const changelog = await request(http).get('/api/snapshots/changelog').set('Cookie', cookie);
    expect(changelog.status).toBe(200);
    // The history ends with the committed snapshot the manifest names, or starts from it.
    expect(changelog.body.entries[0].version).toBe(manifest.body.version);
  });

  it('sends the security headers', async () => {
    const res = await request(http).get('/api/health');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('lets only Vercel Cron reach the keepalive route', async () => {
    const denied = await request(http)
      .get('/api/internal/keepalive')
      .set('Authorization', 'Bearer nope');
    expect(denied.status).toBe(401);
    const ok = await request(http)
      .get('/api/internal/keepalive')
      .set('Authorization', `Bearer ${TEST_CRON_SECRET}`);
    expect(ok.status).toBe(200);
  });

  it('logs out for real: the old cookie stops working', async () => {
    const res = await request(http)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
      .set(CSRF_HEADER, csrf);
    expect(res.status).toBe(204);

    const after = await request(http).get('/api/auth/session').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});

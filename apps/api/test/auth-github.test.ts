import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { DB, type Db } from '../src/db/client.js';
import { sessions, users } from '../src/db/schema.js';
import { createTestApp, GITHUB_ENV } from './helpers.js';

describe('GitHub login', () => {
  let app: NestExpressApplication;
  let auth: AuthService;
  let db: Db;

  beforeAll(async () => {
    app = await createTestApp(GITHUB_ENV);
    auth = app.get(AuthService);
    db = app.get(DB);
  });
  afterAll(async () => {
    await app.close();
  });

  it('redirects to GitHub with a state cookie and no scope', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/github');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location as string);
    expect(location.origin).toBe('https://github.com');
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(location.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/api/auth/github/callback',
    );
    expect(String(res.headers['set-cookie'])).toMatch(/vgc_oauth_state=.*HttpOnly/);
  });

  it('sends a callback with a forged state back to the login screen', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/auth/github/callback?code=abc&state=forged',
    );
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('http://localhost:5173/login?error=oauth_failed');
    expect(res.headers['set-cookie'] ?? []).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^vgc_session=/)]),
    );
  });

  it('denies accounts that are not on the allowlist and writes nothing', async () => {
    const userId = await auth.authorizeGithub({ id: '2002', login: 'intruder', avatarUrl: null });
    expect(userId).toBeNull();
    expect(await db.select().from(users)).toEqual([]);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it('accepts the allowlisted id and keeps the same user when the username changes', async () => {
    const first = await auth.authorizeGithub({ id: '1001', login: 'owner', avatarUrl: null });
    const second = await auth.authorizeGithub({
      id: '1001',
      login: 'owner-renamed',
      avatarUrl: null,
    });
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.login).toBe('owner-renamed');
  });

  it('turns the password login off', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ password: 'anything' });
    expect(res.status).toBe(404);
  });
});

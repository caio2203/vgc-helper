import type { NestExpressApplication } from '@nestjs/platform-express';
import type { FeedbackInput } from '@vgc-helper/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signIn } from './helpers.js';

const vote = (subject: string, helpful: boolean): FeedbackInput => ({
  kind: 'suggestion',
  subject,
  helpful,
  gameId: 'champions',
  formatId: 'champions-vgc',
  regulationId: 'M-C',
  snapshotVersion: 'test',
  score: 13.6,
  rank: 1,
  experienceLevel: 'intermediate',
  team: ['incineroar', 'kingambit'],
});

describe('feedback API', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let auth: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    auth = await signIn(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('stores votes and sums them per suggested species', async () => {
    for (const body of [
      vote('sinistcha', true),
      vote('sinistcha', false),
      vote('pelipper', true),
    ]) {
      const res = await request(http).post('/api/feedback').set(auth).send(body);
      expect(res.status).toBe(201);
    }
    const summary = await request(http).get('/api/feedback/summary').set(auth);
    expect(summary.body).toEqual({
      total: 3,
      helpful: 2,
      bySubject: [
        { subject: 'sinistcha', helpful: 1, notHelpful: 1 },
        { subject: 'pelipper', helpful: 1, notHelpful: 0 },
      ],
    });
  });

  it('rejects bodies that do not match the schema', async () => {
    const res = await request(http)
      .post('/api/feedback')
      .set(auth)
      .send({ ...vote('Not An Id', true) });
    expect(res.status).toBe(400);
  });

  it('needs the CSRF header like every write', async () => {
    const { 'x-csrf-token': _csrf, ...withoutCsrf } = auth;
    const res = await request(http)
      .post('/api/feedback')
      .set(withoutCsrf)
      .send(vote('pelipper', true));
    expect(res.status).toBe(403);
  });
});

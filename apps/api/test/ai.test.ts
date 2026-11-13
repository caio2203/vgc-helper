import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { LlmAnswer, LlmProvider, LlmRequest } from '../src/ai/llm.js';
import { LlmUnavailableError } from '../src/ai/llm.js';
import { createApp } from '../src/app.factory.js';
import { loadConfig } from '../src/config/env.js';
import { createTestApp, signIn, testEnv } from './helpers.js';

const slot = (species: string, moves: string[]) => ({
  species,
  item: null,
  ability: null,
  moves,
  nature: 'adamant',
  spread: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 },
  ivs: null,
  mega: false,
  teraType: null,
  notes: '',
});

const team = {
  gameId: 'champions',
  formatId: 'champions-vgc',
  regulationId: 'M-C',
  slots: [slot('incineroar', ['fakeout', 'flareblitz']), slot('kingambit', ['kowtowcleave'])],
};
const explain = { team, locale: 'en', level: 'intermediate' };

/** Records every request; can call a tool or fail like the real provider. */
class FakeLlm implements LlmProvider {
  readonly model = 'fake-model';
  readonly requests: LlmRequest[] = [];
  toolResults: unknown[] = [];
  error: LlmUnavailableError | null = null;

  async generate(req: LlmRequest): Promise<LlmAnswer> {
    this.requests.push(req);
    if (this.error) throw this.error;
    this.toolResults.push(req.callTool('getUsage', { species: 'Incineroar' }));
    return { text: `Answer ${this.requests.length}`, model: this.model };
  }
}

let app: NestExpressApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function withFake(env: NodeJS.ProcessEnv = {}) {
  const llm = new FakeLlm();
  app = await createApp(loadConfig(await testEnv(env)), undefined, llm);
  return { llm, http: app.getHttpServer(), headers: await signIn(app) };
}

describe('AI without GEMINI_API_KEY', () => {
  it('reports itself disabled and answers no request, while the rest works', async () => {
    app = await createTestApp();
    const http = app.getHttpServer();
    const headers = await signIn(app);
    const status = await request(http).get('/api/ai/status').set(headers);
    expect(status.body).toEqual({ enabled: false, model: null });

    const res = await request(http).post('/api/ai/explain').set(headers).send(explain);
    expect(res.status).toBe(503);
    expect(res.body.reason).toBe('disabled');

    const manifest = await request(http).get('/api/snapshots/manifest').set(headers);
    expect(manifest.status).toBe(200);
  });
});

describe('AI with a provider', () => {
  it('gives the model the engine analysis and the snapshot tools, then caches the answer', async () => {
    const { llm, http, headers } = await withFake();
    expect((await request(http).get('/api/ai/status').set(headers)).body).toEqual({
      enabled: true,
      model: 'fake-model',
    });

    const first = await request(http).post('/api/ai/explain').set(headers).send(explain);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ text: 'Answer 1', model: 'fake-model', cached: false });

    const [req] = llm.requests;
    expect(req?.system).toContain('ANALYSIS JSON:');
    expect(req?.system).toContain('"species":"Incineroar"');
    expect(req?.system).toContain('Write in English');
    expect(req?.tools.map((t) => t.name)).toEqual(['getUsage', 'getCommonSet', 'checkLegality']);
    expect(llm.toolResults[0]).toMatchObject({ found: true, species: 'Incineroar' });

    const again = await request(http).post('/api/ai/explain').set(headers).send(explain);
    expect(again.body).toMatchObject({ text: 'Answer 1', cached: true });
    expect(llm.requests).toHaveLength(1);

    // Another language or level is another answer.
    const pt = await request(http)
      .post('/api/ai/explain')
      .set(headers)
      .send({ ...explain, locale: 'pt-BR' });
    expect(pt.body).toMatchObject({ text: 'Answer 2', cached: false });
    expect(llm.requests[1]?.system).toContain('Brazilian Portuguese');
  });

  it('answers chat questions with the conversation so far', async () => {
    const { llm, http, headers } = await withFake();
    const messages = [
      { role: 'user', text: 'Why not Amoonguss?' },
      { role: 'model', text: 'It is not in the analysis.' },
      { role: 'user', text: 'What beats Trick Room?' },
    ];
    const res = await request(http)
      .post('/api/ai/chat')
      .set(headers)
      .send({ ...explain, messages });
    expect(res.status).toBe(200);
    expect(llm.requests[0]?.messages).toEqual(messages);

    const bad = await request(http)
      .post('/api/ai/chat')
      .set(headers)
      .send({ ...explain, messages: [{ role: 'model', text: 'no question' }] });
    expect(bad.status).toBe(400);
  });

  it('falls back with a reason when the quota is gone or the daily limit is reached', async () => {
    const { llm, http, headers } = await withFake({ AI_DAILY_LIMIT: '1' });
    llm.error = new LlmUnavailableError('quota', 'quota');
    const quota = await request(http).post('/api/ai/explain').set(headers).send(explain);
    expect(quota.status).toBe(429);
    expect(quota.body.reason).toBe('quota');

    llm.error = null;
    expect((await request(http).post('/api/ai/explain').set(headers).send(explain)).status).toBe(
      200,
    );
    const limit = await request(http)
      .post('/api/ai/explain')
      .set(headers)
      .send({ ...explain, level: 'advanced' });
    expect(limit.status).toBe(429);
    expect(limit.body.reason).toBe('dailyLimit');
  });

  it('rejects unknown rules, and writes without the CSRF token', async () => {
    const { http, headers } = await withFake();
    const unknown = await request(http)
      .post('/api/ai/explain')
      .set(headers)
      .send({ ...explain, team: { ...team, regulationId: 'NOPE' } });
    expect(unknown.status).toBe(400);

    const { 'x-csrf-token': _csrf, ...noCsrf } = headers;
    const forbidden = await request(http).post('/api/ai/explain').set(noCsrf).send(explain);
    expect(forbidden.status).toBe(403);
  });
});

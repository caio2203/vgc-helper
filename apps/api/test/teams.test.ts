import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TeamInput } from '@vgc-helper/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signIn } from './helpers.js';

const team: TeamInput = {
  name: 'Sun',
  gameId: 'champions',
  formatId: 'champions-vgc',
  regulationId: 'M-C',
  snapshotVersion: 'test',
  notes: '',
  slots: [
    {
      species: 'incineroar',
      item: 'sitrusberry',
      ability: 'intimidate',
      moves: ['fakeout', 'partingshot'],
      nature: 'careful',
      spread: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
      ivs: null,
      mega: false,
      teraType: null,
      notes: '',
    },
  ],
};

describe('teams API', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let auth: Record<string, string>;
  let id: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    auth = await signIn(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates a team as version 1 and lists it', async () => {
    const created = await request(http).post('/api/teams').set(auth).send(team);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Sun', version: 1 });
    id = created.body.id;

    const list = await request(http).get('/api/teams').set(auth);
    expect(list.body).toEqual([
      expect.objectContaining({ id, name: 'Sun', species: ['incineroar'], version: 1 }),
    ]);
  });

  it('rejects unknown regulations and invalid bodies', async () => {
    const unknown = await request(http)
      .post('/api/teams')
      .set(auth)
      .send({ ...team, regulationId: 'Z-Z' });
    expect(unknown.status).toBe(400);
    const invalid = await request(http).post('/api/teams').set(auth).send({ name: '' });
    expect(invalid.status).toBe(400);
  });

  it('saves a new version and refuses a stale one', async () => {
    const saved = await request(http)
      .put(`/api/teams/${id}`)
      .set(auth)
      .send({ ...team, name: 'Sun v2', expectedVersion: 1 });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(2);

    const stale = await request(http)
      .put(`/api/teams/${id}`)
      .set(auth)
      .send({ ...team, name: 'Other tab', expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.currentVersion).toBe(2);
  });

  it('keeps every version', async () => {
    const versions = await request(http).get(`/api/teams/${id}/versions`).set(auth);
    expect(versions.body.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    const first = await request(http).get(`/api/teams/${id}/versions/1`).set(auth);
    expect(first.body.data.name).toBe('Sun');
  });

  it('duplicates and deletes', async () => {
    const copy = await request(http)
      .post(`/api/teams/${id}/duplicate`)
      .set(auth)
      .send({ name: 'Sun (copy)' });
    expect(copy.status).toBe(201);
    expect(copy.body).toMatchObject({ name: 'Sun (copy)', version: 1 });
    expect(copy.body.id).not.toBe(id);

    expect((await request(http).delete(`/api/teams/${id}`).set(auth)).status).toBe(204);
    expect((await request(http).get(`/api/teams/${id}`).set(auth)).status).toBe(404);
    const list = await request(http).get('/api/teams').set(auth);
    expect(list.body.map((t: { name: string }) => t.name)).toEqual(['Sun (copy)']);
  });

  it('needs the CSRF token to write', async () => {
    const { 'x-csrf-token': _, ...noToken } = auth;
    const res = await request(http).post('/api/teams').set(noToken).send(team);
    expect(res.status).toBe(403);
  });
});

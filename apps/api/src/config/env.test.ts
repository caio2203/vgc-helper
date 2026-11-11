import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../security/password.js';
import { ConfigError, loadConfig } from './env.js';

let hash: string;
beforeAll(async () => {
  hash = await hashPassword('a test password');
});

const base = () => ({
  APP_ORIGIN: 'https://helper.example',
  SESSION_SECRET: 's'.repeat(40),
  AUTH_MODE: 'github',
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret',
  AUTH_ALLOWED_GITHUB_IDS: '123, 456',
});

describe('loadConfig fails closed', () => {
  it('refuses to start without a login method', () => {
    const { AUTH_MODE: _, ...env } = base();
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('refuses usernames in the allowlist', () => {
    expect(() => loadConfig({ ...base(), AUTH_ALLOWED_GITHUB_IDS: 'caio2203' })).toThrow(/numeric/);
  });

  it('refuses an empty allowlist', () => {
    expect(() => loadConfig({ ...base(), AUTH_ALLOWED_GITHUB_IDS: ' , ' })).toThrow(/at least one/);
  });

  it('refuses a short session secret', () => {
    expect(() => loadConfig({ ...base(), SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  });

  it('refuses a missing or broken password hash', () => {
    expect(() => loadConfig({ ...base(), AUTH_MODE: 'local-password' })).toThrow(
      /ADMIN_PASSWORD_HASH/,
    );
    expect(() =>
      loadConfig({ ...base(), AUTH_MODE: 'local-password', ADMIN_PASSWORD_HASH: 'plain-text' }),
    ).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it('refuses a local database file on Vercel', () => {
    expect(() => loadConfig({ ...base(), VERCEL: '1' })).toThrow(/TURSO_DATABASE_URL/);
  });
});

describe('loadConfig with a valid environment', () => {
  it('builds the GitHub config with __Host- cookies over HTTPS', () => {
    const config = loadConfig({
      ...base(),
      VERCEL: '1',
      TURSO_DATABASE_URL: 'libsql://db.turso.io',
    });
    expect(config.auth).toMatchObject({
      mode: 'github',
      callbackUrl: 'https://helper.example/api/auth/github/callback',
    });
    expect(config.auth.mode === 'github' && [...config.auth.allowedIds]).toEqual(['123', '456']);
    expect(config.session.cookieName).toBe('__Host-vgc_session');
    expect(config.trustProxy).toBe(true);
    expect(config.migrateOnBoot).toBe(false);
  });

  it('accepts local-password mode with a valid hash', () => {
    const config = loadConfig({
      ...base(),
      APP_ORIGIN: 'http://localhost:3000',
      AUTH_MODE: 'local-password',
      ADMIN_PASSWORD_HASH: hash,
    });
    expect(config.auth.mode).toBe('local-password');
    expect(config.session.cookieName).toBe('vgc_session');
    expect(config.migrateOnBoot).toBe(true);
  });
});

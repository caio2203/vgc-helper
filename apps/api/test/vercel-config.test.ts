import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WEB_HEADERS } from '../src/security/headers.js';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
  crons: { path: string }[];
  rewrites: { source: string; destination: string }[];
}

const vercel = JSON.parse(
  readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig;

describe('vercel.json', () => {
  it('sends the same security headers as src/security/headers.ts on every web page', () => {
    const web = vercel.headers.find((h) => h.source === '/((?!api/).*)');
    const actual = Object.fromEntries((web?.headers ?? []).map((h) => [h.key, h.value]));
    expect(actual).toEqual(WEB_HEADERS);
  });

  it('routes /api to the function and everything else to the web app', () => {
    expect(vercel.rewrites).toEqual([
      { source: '/api/:path*', destination: '/api' },
      { source: '/((?!api/).*)', destination: '/index.html' },
    ]);
  });

  it('schedules only the keepalive cron', () => {
    expect(vercel.crons.map((c) => c.path)).toEqual(['/api/internal/keepalive']);
  });
});

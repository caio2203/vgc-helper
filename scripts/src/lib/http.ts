import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = fileURLToPath(new URL('../../.cache/', import.meta.url));
const USER_AGENT = 'vgc-helper-data-pipeline (+https://github.com/caio2203/vgc-helper)';
/** The only hosts the pipeline may download from. Add a source here on purpose, not by config. */
const ALLOWED_HOSTS = new Set(['www.smogon.com']);
/** Pause between network requests so we never hammer a source. */
const REQUEST_GAP_MS = 1000;

let lastRequest = 0;

/** Parses and checks a source URL: HTTPS and an allowed host only. */
function checkedUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing to download from ${parsed.origin}: not an allowed data source`);
  }
  return parsed;
}

async function politeFetch(url: URL): Promise<Response> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  return fetch(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'error' });
}

/** Cache file for a URL. Path segments are reduced to safe characters and stay inside .cache. */
function cachePath(url: URL): string {
  const file = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  const segments = [url.hostname, ...file.split('/').filter(Boolean)].map((s) =>
    s.replace(/[^A-Za-z0-9._-]/g, '_'),
  );
  const root = resolve(CACHE_DIR);
  const target = resolve(join(root, ...segments));
  const rel = relative(root, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Cache path escapes the cache folder: ${url.href}`);
  }
  return target;
}

/**
 * Fetches text with an on-disk cache for local reruns. Returns null on 404.
 * Set `cache: false` for listings that change, like the Smogon month index.
 * Everything fetched is validated with zod by the caller before it is used.
 */
export async function fetchText(url: string, { cache = true } = {}): Promise<string | null> {
  const source = checkedUrl(url);
  const path = cachePath(source);
  if (cache) {
    try {
      return await readFile(path, 'utf8');
    } catch {
      // Not cached yet.
    }
  }

  const response = await politeFetch(source);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${source.href} failed with ${response.status}`);
  const text = await response.text();

  if (cache) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }
  return text;
}

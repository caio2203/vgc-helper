import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = fileURLToPath(new URL('../../.cache/', import.meta.url));
const USER_AGENT = 'vgc-helper-data-pipeline (+https://github.com/caio2203/vgc-helper)';
/** Pause between network requests so we never hammer a source. */
const REQUEST_GAP_MS = 1000;

let lastRequest = 0;

async function politeFetch(url: string): Promise<Response> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  return fetch(url, { headers: { 'user-agent': USER_AGENT } });
}

function cachePath(url: string): string {
  const { hostname, pathname } = new URL(url);
  const file = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  return join(CACHE_DIR, hostname, ...file.split('/').filter(Boolean));
}

/**
 * Fetches text with an on-disk cache. Returns null on 404.
 * Set `cache: false` for listings that change, like the Smogon month index.
 */
export async function fetchText(url: string, { cache = true } = {}): Promise<string | null> {
  const path = cachePath(url);
  if (cache) {
    try {
      return await readFile(path, 'utf8');
    } catch {
      // Not cached yet.
    }
  }

  const response = await politeFetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
  const text = await response.text();

  if (cache) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }
  return text;
}

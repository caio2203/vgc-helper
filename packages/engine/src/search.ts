import { toId } from './ids.js';

export type SearchKind = 'species' | 'move' | 'item' | 'ability' | 'nature';

export interface SearchEntry {
  id: string;
  name: string;
  kind: SearchKind;
  /** Extra names that should also match, e.g. a localized name. */
  aliases?: string[];
}

export interface SearchHit extends SearchEntry {
  score: number;
}

interface Indexed {
  entry: SearchEntry;
  keys: string[];
  words: string[];
}

export interface SearchIndex {
  entries: Indexed[];
}

export function buildSearchIndex(entries: SearchEntry[]): SearchIndex {
  return {
    entries: entries.map((entry) => {
      const names = [entry.name, ...(entry.aliases ?? [])];
      return {
        entry,
        keys: names.map(toId),
        words: names.flatMap((n) => n.split(/[\s-]+/).map(toId)).filter(Boolean),
      };
    }),
  };
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent swaps). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j += 1) (d[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j] as number, ((d[i - 2] as number[])[j - 2] as number) + 1);
      }
    }
  }
  return (d[a.length] as number[])[b.length] as number;
}

function isSubsequence(query: string, key: string): boolean {
  let i = 0;
  for (const ch of key) if (ch === query[i]) i += 1;
  return i === query.length;
}

function scoreKey(q: string, key: string, words: string[]): number {
  if (key === q) return 100;
  if (key.startsWith(q)) return 90 - Math.min(9, (key.length - q.length) / 2);
  if (words.some((w) => w.startsWith(q))) return 80;
  if (key.includes(q)) return 70;
  if (q.length >= 3 && isSubsequence(q, key)) return 55;
  if (q.length >= 3) {
    // Typos: compare with the start of the name, allowing 1 edit for short queries, 2 otherwise.
    const allowed = q.length <= 5 ? 1 : 2;
    const distance = Math.min(editDistance(q, key.slice(0, q.length)), editDistance(q, key));
    if (distance <= allowed) return 45 - distance * 5;
  }
  return 0;
}

/**
 * Tolerant search: exact, prefix, word prefix, substring, subsequence ("grchmp"), and small typos
 * ("garchmop"). Accepts partial names and any aliases (such as names in another language).
 */
export function search(
  index: SearchIndex,
  query: string,
  { limit = 20, kinds }: { limit?: number; kinds?: SearchKind[] } = {},
): SearchHit[] {
  const q = toId(query);
  if (q === '') return [];
  const hits: SearchHit[] = [];
  for (const { entry, keys, words } of index.entries) {
    if (kinds && !kinds.includes(entry.kind)) continue;
    const score = Math.max(...keys.map((key) => scoreKey(q, key, words)));
    if (score > 0) hits.push({ ...entry, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

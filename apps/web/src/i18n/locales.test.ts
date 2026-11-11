import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

function keys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function lookup(obj: unknown, path: string): string {
  return path
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
}

const placeholders = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('have the same keys in English and Portuguese', () => {
    expect(keys(ptBR).sort()).toEqual(keys(en).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const key of keys(en)) {
      expect(placeholders(lookup(ptBR, key)), key).toEqual(placeholders(lookup(en, key)));
    }
  });

  it('avoid exclamation marks', () => {
    for (const key of keys(en)) {
      expect(lookup(en, key), key).not.toContain('!');
      expect(lookup(ptBR, key), key).not.toContain('!');
    }
  });
});

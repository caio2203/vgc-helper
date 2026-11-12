import { describe, expect, it } from 'vitest';
import { buildSearchIndex, search } from './search.js';

const index = buildSearchIndex([
  { id: 'garchomp', name: 'Garchomp', kind: 'species' },
  { id: 'gardevoir', name: 'Gardevoir', kind: 'species' },
  { id: 'incineroar', name: 'Incineroar', kind: 'species' },
  { id: 'rillaboom', name: 'Rillaboom', kind: 'species' },
  { id: 'fakeout', name: 'Fake Out', kind: 'move' },
  { id: 'protect', name: 'Protect', kind: 'move' },
  { id: 'sitrusberry', name: 'Sitrus Berry', kind: 'item' },
  { id: 'tailwind', name: 'Tailwind', kind: 'move', aliases: ['Vento a Favor'] },
]);

const names = (q: string, kinds?: Parameters<typeof search>[2]) =>
  search(index, q, kinds).map((h) => h.name);

describe('search', () => {
  it('puts exact and prefix matches first', () => {
    expect(names('gar')).toEqual(['Garchomp', 'Gardevoir']);
    expect(names('Garchomp')[0]).toBe('Garchomp');
  });

  it('matches words inside names and ignores spaces and case', () => {
    expect(names('out')).toEqual(['Fake Out']);
    expect(names('BERRY')).toEqual(['Sitrus Berry']);
    expect(names('fake out')).toEqual(['Fake Out']);
  });

  it('tolerates typos and missing letters', () => {
    expect(names('garchmop')[0]).toBe('Garchomp');
    expect(names('incinroar')[0]).toBe('Incineroar');
    expect(names('rlboom')[0]).toBe('Rillaboom');
  });

  it('matches aliases such as names in another language', () => {
    expect(names('vento')).toEqual(['Tailwind']);
  });

  it('filters by kind and returns nothing for an empty query', () => {
    expect(names('p', { kinds: ['move'] })).toEqual(['Protect']);
    expect(names('   ')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { compareByOrder, isValidOrderKey, keyBetween, keysBetween } from '../fractional-index';

describe('keyBetween', () => {
  it('creates a key for an empty list', () => {
    const key = keyBetween(null, null);
    expect(isValidOrderKey(key)).toBe(true);
  });

  it('creates keys strictly between neighbours', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const mid = keyBetween(a, b);
    expect(a < mid && mid < b).toBe(true);
  });

  it('creates keys before the first item', () => {
    const first = keyBetween(null, null);
    const before = keyBetween(null, first);
    expect(before < first).toBe(true);
  });

  it('survives many repeated insertions into the same gap', () => {
    let lo = keyBetween(null, null);
    const hi = keyBetween(lo, null);
    for (let i = 0; i < 200; i++) {
      const next = keyBetween(lo, hi);
      expect(lo < next && next < hi).toBe(true);
      expect(isValidOrderKey(next)).toBe(true);
      lo = next;
    }
  });

  it('survives repeated prepends', () => {
    let first = keyBetween(null, null);
    for (let i = 0; i < 200; i++) {
      const next = keyBetween(null, first);
      expect(next < first).toBe(true);
      first = next;
    }
  });

  it('rejects out-of-order or invalid bounds', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
    expect(() => keyBetween('a', 'a')).toThrow();
    expect(() => keyBetween('a0', null)).toThrow();
    expect(() => keyBetween('a!', null)).toThrow();
  });
});

describe('keysBetween', () => {
  it('generates n increasing keys', () => {
    for (const [lo, hi] of [
      [null, null],
      ['V', null],
      [null, 'V'],
      ['V', 'W'],
    ] as const) {
      const keys = keysBetween(lo, hi, 12);
      expect(keys).toHaveLength(12);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
      expect(new Set(keys).size).toBe(12);
      if (lo) expect(keys[0]! > lo).toBe(true);
      if (hi) expect(keys[11]! < hi).toBe(true);
    }
  });

  it('returns an empty list for n <= 0', () => {
    expect(keysBetween(null, null, 0)).toEqual([]);
  });
});

describe('compareByOrder', () => {
  it('sorts by order then id for deterministic tie-breaking', () => {
    const items = [
      { id: 'b', order: 'V' },
      { id: 'a', order: 'V' },
      { id: 'c', order: 'K' },
    ];
    expect(items.sort(compareByOrder).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
});

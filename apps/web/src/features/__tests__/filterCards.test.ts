import { createDemoBoard, type Card } from '@taskflow/shared';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  filterCards,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  UNASSIGNED,
} from '../filters/filterCards';

const board = createDemoBoard('demo', Date.UTC(2026, 0, 1));
const cards = Object.values(board.cards);
const titles = (list: Card[]) => list.map((c) => c.title).sort();

describe('filterCards', () => {
  it('returns everything when no filter is active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(filterCards(cards, EMPTY_FILTERS, board)).toHaveLength(cards.length);
  });

  it('matches text case- and accent-insensitively across title, description, labels and people', () => {
    const search = (query: string) => titles(filterCards(cards, { ...EMPTY_FILTERS, query }, board));
    expect(search('SAFARI')).toEqual(['Card drops into wrong column on Safari']);
    expect(search('wcag')).toEqual(['Audit colour contrast in dark mode']); // description
    expect(search('garcia')).toEqual(titles(cards.filter((c) => c.assigneeId === 'mem-sofia'))); // "García"
    expect(search('bug')).toEqual(['Card drops into wrong column on Safari']); // label name
    expect(search('focus rings')).toEqual(['Audit colour contrast in dark mode']); // checklist item
  });

  it('ANDs multiple search terms', () => {
    const result = filterCards(cards, { ...EMPTY_FILTERS, query: 'presence avatars' }, board);
    expect(titles(result)).toEqual(['Real-time presence avatars']);
    expect(filterCards(cards, { ...EMPTY_FILTERS, query: 'presence safari' }, board)).toHaveLength(0);
  });

  it('filters by label, priority and assignee, combined', () => {
    const a11y = filterCards(cards, { ...EMPTY_FILTERS, labelId: 'lbl-a11y' }, board);
    expect(a11y.every((c) => c.labelIds.includes('lbl-a11y'))).toBe(true);
    expect(a11y.length).toBeGreaterThan(1);

    const high = filterCards(cards, { ...EMPTY_FILTERS, priority: 'high' }, board);
    expect(high.every((c) => c.priority === 'high')).toBe(true);

    const combined = filterCards(
      cards,
      { ...EMPTY_FILTERS, labelId: 'lbl-a11y', priority: 'high', assigneeId: 'mem-ava' },
      board,
    );
    expect(titles(combined)).toEqual(['Screen-reader announcements for drag and drop']);
  });

  it('supports an "unassigned" filter', () => {
    const unassigned = filterCards(cards, { ...EMPTY_FILTERS, assigneeId: UNASSIGNED }, board);
    expect(unassigned.length).toBeGreaterThan(0);
    expect(unassigned.every((c) => c.assigneeId === null)).toBe(true);
  });
});

describe('URL serialisation', () => {
  it('round-trips filters through search params and keeps unrelated params', () => {
    const filters = { query: 'dark mode', labelId: 'lbl-a11y', priority: 'high' as const, assigneeId: null };
    const params = filtersToParams(filters, new URLSearchParams('card=card-1'));
    expect(params.get('card')).toBe('card-1');
    expect(params.has('assignee')).toBe(false);
    expect(filtersFromParams(params)).toEqual(filters);
  });

  it('ignores invalid priorities', () => {
    expect(filtersFromParams(new URLSearchParams('priority=critical')).priority).toBeNull();
  });
});

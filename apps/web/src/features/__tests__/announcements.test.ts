import type { Active, Over } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import { buildAnnouncements, type DragTarget } from '../board/announcements';

const targets: Record<string, DragTarget> = {
  card: { kind: 'card', title: 'Fix bug', columnTitle: 'To Do', index: 0, total: 3 },
  'card@done': { kind: 'card', title: 'Fix bug', columnTitle: 'Done', index: 1, total: 2 },
  col: { kind: 'column', title: 'Review', index: 2, total: 4 },
};

const announcements = buildAnnouncements({
  describe: (id, overId) => targets[overId ? `${String(id)}@${String(overId)}` : String(id)] ?? targets[String(id)]!,
});

const active = (id: string) => ({ id }) as Active;
const over = (id: string) => ({ id }) as Over;

describe('drag and drop announcements', () => {
  it('uses human-readable names and positions', () => {
    expect(announcements.onDragStart({ active: active('card') })).toBe(
      'Picked up card “Fix bug”, in column “To Do”, position 1 of 3.',
    );
    expect(announcements.onDragOver({ active: active('card'), over: over('done') })).toBe(
      'Card “Fix bug” is now in column “Done”, position 2 of 2.',
    );
    expect(announcements.onDragEnd({ active: active('card'), over: over('done') })).toBe(
      'Card “Fix bug” was dropped in column “Done”, position 2 of 2.',
    );
    expect(announcements.onDragStart({ active: active('col') })).toBe('Picked up column “Review”, position 3 of 4.');
  });

  it('covers cancel and dropping outside', () => {
    expect(announcements.onDragOver({ active: active('card'), over: null })).toBeUndefined();
    expect(announcements.onDragEnd({ active: active('card'), over: null })).toMatch(/outside the board/);
    expect(announcements.onDragCancel({ active: active('card'), over: null })).toMatch(/cancelled/);
  });
});

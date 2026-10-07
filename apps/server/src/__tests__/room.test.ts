import { describe, expect, it } from 'vitest';
import { Room, RoomRegistry } from '../room';

const user = (id: string) => ({ id, name: id, color: '#000000' });

describe('Room', () => {
  it('collapses multiple tabs of the same user into one presence entry', () => {
    const room = new Room<string>('demo');
    room.join('tab-1', user('ada'));
    room.join('tab-2', user('ada'));
    room.join('tab-3', user('bob'));
    expect(room.size).toBe(3);
    expect(room.presence().map((u) => u.id)).toEqual(['ada', 'bob']);
    expect(room.updatePresence('unknown', user('x'))).toBe(false);
  });

  it('assigns monotonically increasing versions and forgets very old op ids', () => {
    const room = new Room<string>('r');
    for (let i = 1; i <= 1_005; i++) {
      const outcome = room.apply({ type: 'board.rename', title: `T${i}`, id: `op-${i}`, clientId: 'c', ts: i });
      expect(outcome).toEqual({ kind: 'applied', version: i });
    }
    // Recent ids are de-duplicated…
    expect(room.apply({ type: 'board.rename', title: 'x', id: 'op-1005', clientId: 'c', ts: 0 }).kind).toBe(
      'duplicate',
    );
    // …but the window is bounded, so the oldest ids have been evicted.
    expect(room.apply({ type: 'board.rename', title: 'x', id: 'op-1', clientId: 'c', ts: 0 }).kind).toBe('applied');
  });
});

describe('RoomRegistry', () => {
  it('evicts the least recently active empty room when full', () => {
    const registry = new RoomRegistry<string>(2);
    const a = registry.getOrCreate('a');
    a.lastActiveAt = 1;
    const b = registry.getOrCreate('b');
    b.join('conn', user('x'));
    registry.getOrCreate('c');
    expect(registry.get('a')).toBeUndefined();
    expect(registry.get('b')).toBeDefined();
    expect(registry.size).toBe(2);
    expect(registry.connectionCount()).toBe(1);
  });
});

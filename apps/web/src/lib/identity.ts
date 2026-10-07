import { isPresenceUser, type PresenceUser } from '@taskflow/shared';
import { createId } from './id';
import { readJson, writeJson } from './storage';

const STORAGE_KEY = 'taskflow:user';

const ADJECTIVES = ['Swift', 'Clever', 'Brave', 'Calm', 'Bright', 'Bold', 'Witty', 'Keen', 'Lucky', 'Sunny'];
const ANIMALS = ['Otter', 'Falcon', 'Panda', 'Fox', 'Koala', 'Lynx', 'Heron', 'Orca', 'Badger', 'Gecko'];

/** Saturated colours that keep white initials readable (WCAG AA for large text). */
export const PRESENCE_COLORS = [
  '#4f46e5',
  '#0284c7',
  '#0d9488',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#9333ea',
  '#475569',
] as const;

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

export function createRandomUser(random: () => number = Math.random): PresenceUser {
  return {
    id: createId('user'),
    name: `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)}`,
    color: pick(PRESENCE_COLORS, random),
  };
}

/** Loads the persisted identity or creates (and saves) a random one on first visit. */
export function loadUser(): PresenceUser {
  const stored = readJson(STORAGE_KEY, isPresenceUser);
  if (stored) return stored;
  const user = createRandomUser();
  writeJson(STORAGE_KEY, user);
  return user;
}

export function saveUser(user: PresenceUser): void {
  writeJson(STORAGE_KEY, user);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

import { DEMO_BOARD_ID } from '@taskflow/shared';
import { readJson, writeJson } from './storage';

export interface RecentBoard {
  id: string;
  title: string;
  visitedAt: number;
}

const STORAGE_KEY = 'taskflow:recent-boards';
const MAX_RECENT = 8;

function isRecentBoards(value: unknown): value is RecentBoard[] {
  return (
    Array.isArray(value) &&
    value.every(
      (b) =>
        typeof b === 'object' &&
        b !== null &&
        typeof (b as RecentBoard).id === 'string' &&
        typeof (b as RecentBoard).title === 'string' &&
        typeof (b as RecentBoard).visitedAt === 'number',
    )
  );
}

export function getRecentBoards(): RecentBoard[] {
  const boards = readJson(STORAGE_KEY, isRecentBoards) ?? [];
  if (!boards.some((b) => b.id === DEMO_BOARD_ID)) {
    boards.push({ id: DEMO_BOARD_ID, title: 'Product Launch', visitedAt: 0 });
  }
  return boards.sort((a, b) => b.visitedAt - a.visitedAt);
}

export function rememberBoard(id: string, title: string, now = Date.now()): RecentBoard[] {
  const rest = getRecentBoards().filter((b) => b.id !== id);
  const next = [{ id, title, visitedAt: now }, ...rest].slice(0, MAX_RECENT);
  writeJson(STORAGE_KEY, next);
  return next;
}

export function getLastBoardId(): string {
  return getRecentBoards()[0]?.id ?? DEMO_BOARD_ID;
}

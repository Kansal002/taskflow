/**
 * Fractional indexing.
 *
 * Every orderable entity carries an `order` key — a base-62 string compared
 * lexicographically. To insert between two neighbours we generate a key that
 * sorts strictly between theirs, so a move is a single-field update on the
 * moved item only. Two clients moving *different* cards concurrently can
 * therefore never clobber each other's positions.
 *
 * If two clients pick the same key for different items (both dropped into the
 * same gap at the same time), {@link compareByOrder} breaks the tie by id, so
 * every replica still converges on the same ordering.
 *
 * Based on the approach described by Evan Wallace (Figma) and David Greenspan
 * (rocicorp/fractional-indexing), simplified to keys without an integer part.
 */

export const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0] as string;

function digitValue(ch: string | undefined): number {
  if (ch === undefined) return 0;
  const value = DIGITS.indexOf(ch);
  if (value === -1) throw new Error(`Invalid order key character: "${ch}"`);
  return value;
}

/**
 * Returns a key strictly between `a` and `b` (`b === null` means "no upper
 * bound"). Neither input may end in the zero digit.
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`Order keys out of range: ${a} >= ${b}`);
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new Error('Order keys must not end with the zero digit');
  }

  if (b !== null) {
    // Skip the shared prefix: treat `a` as padded with zeros.
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }

  const digitA = a ? digitValue(a[0]) : 0;
  const digitB = b !== null ? digitValue(b[0]) : DIGITS.length;

  if (digitB - digitA > 1) {
    return DIGITS[Math.round((digitA + digitB) / 2)] as string;
  }
  // Digits are adjacent.
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return (DIGITS[digitA] as string) + midpoint(a.slice(1), null);
}

export function isValidOrderKey(key: string): boolean {
  if (key.length === 0 || key.endsWith(ZERO)) return false;
  for (const ch of key) if (!DIGITS.includes(ch)) return false;
  return true;
}

/**
 * Generates an order key that sorts after `before` and before `after`.
 * Pass `null` for an open end (start / end of the list).
 */
export function keyBetween(before: string | null, after: string | null): string {
  if (before !== null && !isValidOrderKey(before)) throw new Error(`Invalid order key: ${before}`);
  if (after !== null && !isValidOrderKey(after)) throw new Error(`Invalid order key: ${after}`);
  return midpoint(before ?? '', after);
}

/** Generates `n` evenly-ish spread, increasing keys between two bounds. */
export function keysBetween(before: string | null, after: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [keyBetween(before, after)];
  if (after === null) {
    const keys: string[] = [];
    let prev = before;
    for (let i = 0; i < n; i++) {
      prev = keyBetween(prev, null);
      keys.push(prev);
    }
    return keys;
  }
  const mid = Math.floor(n / 2);
  const midKey = keyBetween(before, after);
  return [...keysBetween(before, midKey, mid), midKey, ...keysBetween(midKey, after, n - mid - 1)];
}

/** Deterministic comparator: order key first, id as tie-breaker. */
export function compareByOrder<T extends { order: string; id: string }>(a: T, b: T): number {
  if (a.order < b.order) return -1;
  if (a.order > b.order) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

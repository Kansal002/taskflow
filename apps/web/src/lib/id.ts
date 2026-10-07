/** Collision-resistant id (UUID v4 where available, random fallback for older runtimes). */
export function createId(prefix = ''): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${id}` : id;
}

/** Short, URL-friendly id for new boards, e.g. `k3j9x2ab`. */
export function createBoardId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Identifies this browser tab. Distinct from the user id (one user may have many tabs). */
export const TAB_ID = createId('tab');

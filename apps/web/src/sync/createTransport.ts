import type { PresenceUser } from '@taskflow/shared';
import { TAB_ID } from '../lib/id';
import { BroadcastChannelTransport } from './BroadcastChannelTransport';
import type { SyncTransport } from './transport';
import { WebSocketTransport } from './WebSocketTransport';

/** The configured sync server, if any. Empty → local (BroadcastChannel) mode. */
export const SYNC_SERVER_URL: string = (import.meta.env.VITE_WS_URL ?? '').trim();

/**
 * Picks the transport for this deployment: a real WebSocket server when
 * `VITE_WS_URL` is set, otherwise cross-tab sync with localStorage persistence.
 */
export function createTransport(boardId: string, user: PresenceUser, url = SYNC_SERVER_URL): SyncTransport {
  return url
    ? new WebSocketTransport({ url, boardId, user })
    : new BroadcastChannelTransport({ boardId, user, tabId: TAB_ID });
}

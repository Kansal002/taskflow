/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL of the sync server. Leave empty for local cross-tab mode. */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

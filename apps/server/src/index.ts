import { startSyncServer } from './server';

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);

const server = await startSyncServer({ port, allowedOrigins, log });

log(`TaskFlow sync server listening on :${server.port}`);
log(
  allowedOrigins.length
    ? `Accepting WebSocket connections from: ${allowedOrigins.join(', ')}`
    : 'ALLOWED_ORIGINS not set — accepting WebSocket connections from any origin',
);

const shutdown = (signal: string) => {
  log(`${signal} received, shutting down`);
  server
    .close()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

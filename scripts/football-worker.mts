import http from 'node:http';
import { pool } from '../server/db/index.js';
import { env } from '../server/env.js';
import { startFootballScheduler, stopFootballScheduler } from '../server/football/scheduler.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const healthServer = http.createServer((req, res) => {
  if (req.url === '/api/health' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, service: 'football-worker' }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[CABBA] football worker shutdown requested (${signal})`);
  stopFootballScheduler();
  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
  await pool.end();
  console.log('[CABBA] football worker stopped cleanly.');
  process.exit(0);
}

// Le bundle est émis avec --format=cjs, qui refuse le `await` au premier niveau :
// le garde de démarrage doit donc vivre dans une fonction asynchrone.
async function main() {
  if (!env.apiFootballKey) {
    console.error('[CABBA] Football worker cannot start: API_FOOTBALL_KEY is missing.');
    await pool.end();
    process.exit(1);
  }

  healthServer.listen(port, host, () => {
    console.log(`[CABBA] Football worker health endpoint listening on http://${host}:${port}`);
    console.log('[CABBA] Football worker starting (scheduler only; no web application).');
    startFootballScheduler();
  });

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

void main();

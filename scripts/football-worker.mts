// Worker API-Football : singleton Cloud Run (maxScale=1) qui exécute le
// scheduler et les rappels push — aucune route applicative n'y est servie.
//
// Robustesse (alignée sur server.ts) :
//  1. handler 'error' sur healthServer : un port pris ou une erreur socket
//     émettait un événement non écouté → crash sans diagnostic exploitable ;
//  2. arrêt à délai forcé (10 s) : si close() ou pool.end() suspend, sortie
//     explicite au lieu d'attendre le SIGKILL de l'hébergeur ;
//  3. unhandledRejection journalisé : le worker ne doit ni mourir en silence
//     ni perdre la trace d'un rejet isolé (broadcastPush, tick…).
import http from 'node:http';
import { pool } from '../server/db/index.js';
import { env } from '../server/env.js';
import { startFootballScheduler, stopFootballScheduler } from '../server/football/scheduler.js';

process.on('unhandledRejection', (reason) => {
  console.error('[CABBA] football worker unhandledRejection:', reason);
});

async function main(): Promise<void> {
  if (!env.apiFootballKey) {
    console.error('[CABBA] Football worker cannot start: API_FOOTBALL_KEY is missing.');
    await pool.end().catch((error) => console.error('[CABBA] pool.end:', error));
    process.exit(1);
  }

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

  healthServer.on('error', (error) => {
    console.error('[CABBA] football worker health server error:', error);
  });

  // Démarrage vérifié : si le port est pris, main() rejette et le processus
  // sort avec un message clair plutôt que de tourner sans health endpoint.
  await new Promise<void>((resolve, reject) => {
    healthServer.once('error', reject);
    healthServer.listen(port, host, () => {
      healthServer.removeListener('error', reject);
      console.log(`[CABBA] Football worker health endpoint listening on http://${host}:${port}`);
      console.log('[CABBA] Football worker starting (scheduler only; no web application).');
      startFootballScheduler();
      resolve();
    });
  });

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[CABBA] football worker shutdown requested (${signal})`);
    stopFootballScheduler();

    void (async () => {
      await new Promise<void>((resolve) => healthServer.close(() => resolve()));
      await pool.end();
      console.log('[CABBA] football worker stopped cleanly.');
      process.exit(0);
    })().catch((error) => {
      console.error('[CABBA] football worker shutdown error:', error);
      process.exit(1);
    });

    // Même contrat que server.ts : sortie forcée après 10 s. unref() pour que
    // le timer ne retienne pas l'event loop si l'arrêt propre gagne la course.
    setTimeout(() => {
      console.error('[CABBA] football worker forced shutdown after grace period.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

// Pas de top-level await : esbuild --format=cjs le rejette.
main().catch((error) => {
  console.error('[CABBA] football worker failed to start:', error);
  process.exit(1);
});

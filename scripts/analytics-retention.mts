// Purge RGPD (limitation de conservation, art. 5.1.e).
//
// analytics_events et push_notification_log grossissaient sans limite. Le
// tableau de bord n'agrège que 7/30/90 jours : au-delà, la donnée n'a plus
// d'usage légitime. Politique : 90 jours (surchargeable par env), suppression
// PAR LOTS de 10 000 lignes — un DELETE massif prendrait un lock long sur une
// table très écrite et bloquerait les INSERT du trafic live.
//
// Exécution : job Cloud Run quotidien (deploy/cloudrun-retention-job.yaml)
// ou `npm run retention` en local.

import { pool, query } from '../server/db/index.js';

const ANALYTICS_RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 90);
const PUSH_LOG_RETENTION_DAYS = Number(process.env.PUSH_LOG_RETENTION_DAYS ?? 90);

/** Taille d'un lot : converge vite tout en gardant des locks courts. */
const BATCH_SIZE = 10_000;

/** Garde-fou : une exécution ne doit jamais tourner plus de ~10 minutes. */
const MAX_ITERATIONS = 100;

async function purgeInBatches(table: string, days: number): Promise<number> {
  let total = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const result = await query(
      `DELETE FROM ${table}
       WHERE id IN (
         SELECT id FROM ${table}
         WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
         LIMIT $2
       )`,
      [days, BATCH_SIZE],
    );
    const deleted = result.rowCount ?? 0;
    total += deleted;
    if (deleted < BATCH_SIZE) break; // dernier lot partiel : convergence
  }

  return total;
}

async function main(): Promise<void> {
  if (!Number.isInteger(ANALYTICS_RETENTION_DAYS) || ANALYTICS_RETENTION_DAYS < 1) {
    throw new Error(`ANALYTICS_RETENTION_DAYS invalide : ${process.env.ANALYTICS_RETENTION_DAYS}`);
  }
  if (!Number.isInteger(PUSH_LOG_RETENTION_DAYS) || PUSH_LOG_RETENTION_DAYS < 1) {
    throw new Error(`PUSH_LOG_RETENTION_DAYS invalide : ${process.env.PUSH_LOG_RETENTION_DAYS}`);
  }

  const events = await purgeInBatches('analytics_events', ANALYTICS_RETENTION_DAYS);
  console.log(`[CABBA] rétention : ${events} événements analytics supprimés (> ${ANALYTICS_RETENTION_DAYS} j).`);

  // push_notification_log ne sert qu'à dédupliquer les envois (event_key) :
  // au-delà de la fenêtre, une redélivrance d'un événement aussi ancien est
  // impossible — la purge ne casse aucune fonctionnalité.
  const pushLog = await purgeInBatches('push_notification_log', PUSH_LOG_RETENTION_DAYS);
  console.log(`[CABBA] rétention : ${pushLog} lignes de journal push supprimées (> ${PUSH_LOG_RETENTION_DAYS} j).`);
}

main()
  .catch((error) => {
    console.error('[CABBA] rétention analytics échouée :', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

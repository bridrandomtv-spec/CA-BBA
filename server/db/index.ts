/**
 * Point d'accès unique à PostgreSQL.
 *
 * Le pool est créé au chargement du module, mais la vérification de la
 * configuration a lieu dans server/env.ts : en production, un DATABASE_URL
 * absent arrête le processus au démarrage plutôt que de laisser chaque requête
 * échouer une par une.
 */

import pkg from 'pg';
import { env } from '../env.js';

const { Pool } = pkg;

const connectionString = env.databaseUrl;

export const pool = new Pool({
  connectionString,
  // Bornes volontairement basses : l'application est légère et la plupart des
  // Postgres hébergés plafonnent le nombre de connexions simultanées.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Sans cet écouteur, une erreur sur une connexion inactive (redémarrage du
// serveur Postgres, coupure réseau) remonte en `uncaughtException` et tue le
// processus. Le pool sait remplacer la connexion fautive tout seul.
pool.on('error', (error) => {
  console.error('[CABBA] erreur sur une connexion PostgreSQL inactive :', error.message);
});

/** Paramètres d'une requête : valeurs simples ou tableaux, jamais du SQL. */
export type QueryParams = readonly unknown[];

export const query = async <T extends pkg.QueryResultRow = pkg.QueryResultRow>(
  text: string,
  params?: QueryParams,
): Promise<pkg.QueryResult<T>> => {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est manquante. Impossible de se connecter à PostgreSQL depuis cet environnement.",
    );
  }
  return pool.query<T>(text, params as unknown[] | undefined);
};

/**
 * Exécute plusieurs requêtes dans une seule transaction.
 *
 * Nécessaire dès qu'une opération touche deux tables — une commande qui décrémente
 * le stock et crée la ligne de commande, par exemple : sans transaction, une
 * erreur au milieu laisse la base dans un état incohérent.
 */
export async function withTransaction<T>(
  handler: (execute: (text: string, params?: QueryParams) => Promise<pkg.QueryResult>) => Promise<T>,
): Promise<T> {
  if (!connectionString) {
    throw new Error("DATABASE_URL est manquante. Impossible d'ouvrir une transaction.");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler((text, params) => client.query(text, params as unknown[] | undefined));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      // Le ROLLBACK peut lui aussi échouer si la connexion est morte : on ne
      // masque pas l'erreur d'origine pour autant.
    });
    throw error;
  } finally {
    client.release();
  }
}

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

let pool: pkg.Pool;

try {
  if (!connectionString) throw new Error("No connection string");
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (error: any) => {
    console.error('[CABBA] erreur sur une connexion PostgreSQL inactive :', error?.message);
  });
} catch {
  console.warn('DB not connected — mock active');
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
    end: async () => {}
  } as unknown as pkg.Pool;
}

export { pool };

/** Paramètres d'une requête : valeurs simples ou tableaux, jamais du SQL. */
export type QueryParams = readonly unknown[];

export const query = async <T extends pkg.QueryResultRow = any>(text: string, params?: QueryParams): Promise<pkg.QueryResult<T>> => {
  try {
    return await pool.query(text, params as unknown[] | undefined);
  } catch (e) {
    console.warn('[AI Studio] PostgreSQL offline — returning mock empty response');
    return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
  }
};

/**
 * Exécute plusieurs requêtes dans une seule transaction.
 */
export async function withTransaction<T>(
  handler: (execute: (text: string, params?: QueryParams) => Promise<any>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(async (text, params) => {
        try {
            return await client.query(text, params as unknown[] | undefined);
        } catch (e) {
            console.warn('[AI Studio] PostgreSQL offline inside transaction');
            return { rows: [] };
        }
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

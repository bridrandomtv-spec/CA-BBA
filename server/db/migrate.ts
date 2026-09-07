import { pool } from './index.js';
import fs from 'node:fs';
import path from 'node:path';

async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(process.cwd(), 'server', 'db', 'migrations');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const applied = await pool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename',
    );
    const done = new Set(applied.rows.map((row) => row.filename));

    for (const file of files) {
      if (done.has(file)) {
        console.log(`Skipping migration: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[CABBA] Migration failed: ${file}`);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('[CABBA] Migration process failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error('[CABBA] Unexpected migration error:', error);
  process.exitCode = 1;
});

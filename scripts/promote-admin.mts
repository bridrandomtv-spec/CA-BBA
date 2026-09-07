/**
 * Promeut le premier utilisateur inscrit au rôle administrateur.
 *
 * L'inscription écrit `role = 'user'` en dur : aucune requête ne peut
 * s'auto-promouvoir. Ce script est donc le seul chemin prévu pour créer un
 * premier administrateur sur une installation neuve.
 *
 * Usage : npm run promote:admin [-- --yes]
 */

import readline from 'node:readline/promises';
import { pool } from '../server/db/index.js';

const assumeYes = process.argv.includes('--yes');

/** Même contrôle que `isEmailShaped` dans server/auth.ts. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ask = async (question: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
};

async function main(): Promise<void> {
  const where = await pool.query<{ database: string; host: string; port: string; role: string }>(
    `SELECT current_database() AS database,
            COALESCE(host(inet_server_addr())::text, 'local/socket') AS host,
            COALESCE(inet_server_port()::text, '?') AS port,
            current_user AS role`,
  );
  const target = where.rows[0];
  console.log(`Base cible : ${target.database} @ ${target.host}:${target.port} (role PostgreSQL ${target.role})`);

  // created_at est nullable : NULLS LAST évite qu'une ligne sans horodatage
  // ne soit considérée comme la plus ancienne.
  const users = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: string | null;
    created_at: Date | null;
  }>('SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at ASC NULLS LAST, id ASC');

  if (users.rows.length === 0) {
    console.error(
      "\nAucun compte en base. Inscrivez-vous d'abord depuis l'application (npm run dev), puis relancez ce script.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n${users.rows.length} compte(s), du plus ancien au plus récent :`);
  users.rows.forEach((user, index) => {
    const date = user.created_at ? user.created_at.toISOString() : '(created_at NULL)';
    console.log(`  ${index === 0 ? '->' : '  '} ${date}  role=${user.role ?? 'NULL'}  ${user.email}`);
  });

  const first = users.rows[0];

  if (first.role === 'admin') {
    console.log(`\nLe premier inscrit (${first.email}) est déjà administrateur. Rien à faire.`);
    return;
  }

  if (!EMAIL_SHAPE.test(first.email)) {
    console.warn(
      `\nATTENTION : « ${first.email} » n'a pas la forme d'une adresse email.\n` +
        "Ce compte ne pourra pas se connecter — /api/auth/login compare sur lower(trim(email)),\n" +
        'une valeur stockée en majuscules ou sans arobase ne correspondra jamais.',
    );
  }

  console.log(`\nPromotion prévue : ${first.email} -> role 'admin'`);
  if (!assumeYes) {
    const answer = await ask('Confirmer cette élévation de privilège ? [o/N] ');
    if (!/^(o|oui|y|yes)$/i.test(answer.trim())) {
      console.log('Annulé, aucune modification.');
      return;
    }
  }

  const updated = await pool.query<{ email: string; role: string }>(
    `UPDATE users SET role = 'admin', updated_at = NOW()
     WHERE id = $1
     RETURNING email, role`,
    [first.id],
  );

  if (updated.rows.length === 0) {
    console.error('\nLa mise à jour n’a touché aucune ligne : le compte a disparu entre-temps.');
    process.exitCode = 1;
    return;
  }

  // Le rôle est relu en base à chaque requête par requireAuth : la promotion
  // prend effet immédiatement, sans nouveau jeton ni reconnexion.
  const check = await pool.query<{ role: string | null }>('SELECT role FROM users WHERE id = $1', [first.id]);
  const admins = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role = 'admin'");
  console.log(`\nPromu : ${updated.rows[0].email} -> ${check.rows[0].role}`);
  console.log(`Administrateurs en base : ${admins.rows[0].n}`);
}

main()
  .catch((error: unknown) => {
    console.error('[CABBA] échec de la promotion :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

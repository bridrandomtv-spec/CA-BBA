/**
 * Crée directement un premier compte administrateur, sans démarrer le serveur.
 *
 * `/api/auth/register` écrit `role = 'user'` en dur — à juste titre, aucune
 * requête ne doit pouvoir s'auto-promouvoir. Une installation neuve n'a donc
 * aucun chemin vers un premier administrateur ; c'est le rôle de ce script.
 *
 * Il réutilise la normalisation, la validation et le coût de hachage de
 * l'application plutôt que de les dupliquer : un compte créé ici est
 * indiscernable d'un compte inscrit via l'API, au rôle près.
 *
 * Le mot de passe est lu sur l'entrée standard et n'est jamais affiché,
 * journalisé, ni écrit dans un fichier.
 *
 * Usage : npm run create:admin
 */

import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { pool, query } from '../server/db/index.js';
import { BCRYPT_ROUNDS, MIN_PASSWORD_LENGTH, isEmailShaped, normalizeEmail } from '../server/auth.js';

/** Lit une ligne sans écho quand un TTY est disponible. */
const readSecret = async (question: string): Promise<string> => {
  const { stdin, stdout } = process;
  stdout.write(question);

  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    // Entrée redirigée : impossible de masquer, on lit la ligne entière.
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      const answer = await rl.question('');
      stdout.write('\n');
      return answer;
    } finally {
      rl.close();
    }
  }

  return new Promise((resolve) => {
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();

    const onData = (buffer: Buffer) => {
      for (const char of buffer.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode?.(false);
          stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on('data', onData);
  });
};

const fail = (message: string): never => {
  console.error(`\n${message}`);
  console.error('Aucun compte n’a été créé.');
  process.exitCode = 1;
  throw new Error(message);
};

async function main(): Promise<void> {
  const where = await query<{ database: string; host: string; port: string; role: string }>(
    `SELECT current_database() AS database,
            COALESCE(host(inet_server_addr())::text, 'local/socket') AS host,
            COALESCE(inet_server_port()::text, '?') AS port,
            current_user AS role`,
  );
  const target = where.rows[0];
  console.log(`Base cible : ${target.database} @ ${target.host}:${target.port} (role PostgreSQL ${target.role})`);

  if (!process.stdin.isTTY) {
    console.warn(
      '\nAvertissement : l’entrée standard n’est pas interactive (pipe ou redirection).\n' +
        'Ce script se pilote au clavier et s’arrêterait sans rien créer — lancez-le directement\n' +
        'dans un terminal : npm run create:admin',
    );
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let email: string;
  let displayName: string;
  try {
    email = normalizeEmail(await rl.question('\nEmail : '));
    displayName = (await rl.question('Nom affiché : ')).trim();
  } finally {
    rl.close();
  }

  if (!isEmailShaped(email)) {
    fail(`« ${email || '(vide)'} » n'est pas une adresse email valide.`);
  }
  if (!displayName) {
    fail('Le nom affiché est obligatoire.');
  }
  if (displayName.length > 100) {
    fail('Le nom affiché dépasse 100 caractères.');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    fail(`Un compte existe déjà pour ${email}. Utilisez plutôt « npm run promote:admin ».`);
  }

  const password = await readSecret(`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum) : `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Mot de passe trop court : ${password.length} caractère(s), ${MIN_PASSWORD_LENGTH} requis.`);
  }

  const admins = await query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role = 'admin'");
  console.log(`\nCréation d'un compte administrateur : ${email} (« ${displayName} »)`);
  console.log(`Administrateurs actuels en base : ${admins.rows[0].n}`);

  const confirmRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await confirmRl.question('Confirmer ? [o/N] ');
  confirmRl.close();
  if (!/^(o|oui|y|yes)$/i.test(confirm.trim())) {
    console.log('\nAnnulé, aucun compte créé.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const created = await query<{ id: string; email: string; display_name: string; role: string }>(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin')
     RETURNING id, email, display_name, role`,
    [email, passwordHash, displayName],
  );

  const user = created.rows[0];
  console.log(`\nCompte créé : ${user.email} — role ${user.role} — id ${user.id}`);
  console.log('Vous pouvez vous connecter immédiatement.');
}

main()
  .catch((error: unknown) => {
    if (process.exitCode !== 1) {
      console.error('[CABBA] échec de la création :', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  })
  .finally(() => pool.end());

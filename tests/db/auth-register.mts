/**
 * Test d'intégration du flux d'inscription et de connexion.
 *
 * Contrairement aux tests `tests/*.test.mjs`, qui font des `assert.match` sur le
 * texte des fichiers, celui-ci exécute réellement les handlers montés par
 * server.ts. Il a donc besoin d'une base PostgreSQL : sans elle, les cas sont
 * sautés explicitement plutôt que de faire échouer le run.
 *
 * Lancement : npm run test:db
 *
 * Le nom ne porte volontairement pas le motif `.test.mts` : `npm test` lance
 * `node --test` sans argument, et depuis Node 22 la découverte par défaut
 * inclut les fichiers TypeScript `*.test.mts`. Ce test serait alors chargé sans
 * tsx et échouerait sur ses imports. Il n'est lancé que par le chemin explicite
 * de `npm run test:db`.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { authRouter } from '../../server/auth.js';
import { pool, query } from '../../server/db/index.js';

type Handler = (req: unknown, res: unknown, next: unknown) => Promise<void>;

/**
 * Récupère le handler réellement enregistré sur le routeur. Le réécrire ici
 * testerait une copie qui peut diverger silencieusement du code de production.
 */
function routeHandler(path: string): Handler {
  type Stack = Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }>;
  const layer = (authRouter as unknown as { stack: Stack }).stack.find(
    (l) => l.route?.path === path && l.route?.methods?.post,
  );
  if (!layer?.route) throw new Error(`handler POST ${path} introuvable dans authRouter`);
  return layer.route.stack[0].handle as Handler;
}

const register = routeHandler('/register');
const login = routeHandler('/login');

interface Captured {
  status: number;
  body: any;
  cookies: Array<{ name: string; valueLength: number; options: Record<string, unknown> }>;
  cleared: string[];
  nextCalled: boolean;
}

async function call(handler: Handler, body: unknown): Promise<Captured> {
  const captured: Captured = { status: 200, body: {}, cookies: [], cleared: [], nextCalled: false };
  const res = {
    // Express répond 200 par défaut et les chemins de succès appellent un
    // `res.json()` nu : démarrer à 0 ferait passer un succès pour un échec.
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(payload: unknown) {
      captured.body = payload;
      return res;
    },
    // Un cookie de session est un JWT valide : on ne note jamais sa valeur.
    cookie(name: string, value: string, options: Record<string, unknown>) {
      captured.cookies.push({ name, valueLength: String(value).length, options });
      return res;
    },
    clearCookie(name: string) {
      captured.cleared.push(name);
      return res;
    },
    setHeader() {
      return res;
    },
  };
  await handler({ body, ip: '127.0.0.1', cookies: {} }, res, () => {
    captured.nextCalled = true;
  });
  return captured;
}

/** Base indisponible ou non migrée : on saute au lieu de casser le run (CI sans PostgreSQL). */
let skipReason: string | false = false;
try {
  await pool.query('SELECT 1 FROM users LIMIT 1');
} catch (error: any) {
  skipReason = `base PostgreSQL indisponible ou table users absente : ${error?.message ?? error}`;
}

/** Identifiants créés par les tests, supprimés dans le crochet `after`. */
const createdIds: string[] = [];

/** Email unique par run : un email fixe ferait échouer le second run sur le 409. */
const uniqueEmail = () => `cabba.test.${randomUUID()}@example.com`;
const PASSWORD = 'mot-de-passe-de-test';

after(async () => {
  if (!skipReason && createdIds.length > 0) {
    // email_log référence users : si l'envoi est configuré un jour, l'email de
    // bienvenue laisserait une ligne qui bloquerait la suppression du compte.
    await query('DELETE FROM email_log WHERE user_id = ANY($1::uuid[])', [createdIds]).catch(() => {});
    const deleted = await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdIds]);
    assert.equal(deleted.rowCount, createdIds.length, 'nettoyage incomplet : des comptes de test restent en base');
  }
  await pool.end();
});

const userCount = async () => (await query<{ n: number }>('SELECT count(*)::int AS n FROM users')).rows[0].n;

test('les entrées invalides sont refusées sans rien écrire en base', { skip: skipReason }, async () => {
  const LONG_NAME = 'a'.repeat(101);
  const valid = { email: uniqueEmail(), password: PASSWORD, displayName: 'Supporter Test', termsAccepted: true };

  const cases: Array<{ label: string; body: unknown; status: number }> = [
    { label: 'corps vide', body: {}, status: 400 },
    { label: 'champs non-string', body: { email: 123, password: PASSWORD, displayName: 'Test', termsAccepted: true }, status: 400 },
    { label: 'email sans arobase', body: { ...valid, email: 'pas-un-email' }, status: 400 },
    { label: 'mot de passe trop court', body: { ...valid, password: 'court' }, status: 400 },
    { label: 'nom réduit à des espaces', body: { ...valid, displayName: '   ', termsAccepted: true }, status: 400 },
    { label: 'nom de plus de 100 caractères', body: { ...valid, displayName: LONG_NAME }, status: 400 },
  ];

  const before = await userCount();

  for (const c of cases) {
    const r = await call(register, c.body);
    assert.equal(r.status, c.status, c.label);
    assert.equal(r.cookies.length, 0, `${c.label} : aucune session ne doit être ouverte`);
    assert.equal(r.nextCalled, false, `${c.label} : le handler est terminal`);
    assert.ok(typeof r.body?.error === 'string' && r.body.error.length > 0, `${c.label} : message d'erreur attendu`);
  }

  assert.equal(await userCount(), before, 'un cas rejeté a malgré tout créé un compte');
});

test("l'inscription crée un utilisateur standard, normalise l'email et ignore un role forgé", { skip: skipReason }, async () => {
  // `role: 'admin'` est volontairement envoyé : le handler écrit le rôle en dur,
  // un corps de requête ne doit jamais pouvoir créer un administrateur.
  const r = await call(register, {
    email: '  Cabba.Test.' + randomUUID().toUpperCase() + '@Example.COM  ',
    password: PASSWORD,
    displayName: '  Supporter Test  ',
    role: 'admin',
  });

  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'user', 'un role envoyé dans le corps a été honoré');
  assert.equal(r.body.user.email, r.body.user.email.toLowerCase());
  assert.equal(r.body.user.displayName, 'Supporter Test', 'le nom doit être trimé');

  assert.equal(r.cookies.length, 1, "l'inscription ouvre une session");
  assert.equal(r.cookies[0].name, 'session');
  assert.equal(r.cookies[0].options.httpOnly, true);
  assert.equal(r.cookies[0].options.sameSite, 'lax');
  assert.equal(r.cookies[0].options.maxAge, 7 * 24 * 60 * 60 * 1000);

  const row = (
    await query<{ password_hash: string; role: string; email: string; created_at: Date }>(
      'SELECT password_hash, role, email, created_at FROM users WHERE id = $1',
      [r.body.user.id],
    )
  ).rows[0];
  createdIds.push(r.body.user.id);

  assert.equal(row.role, 'user');
  assert.equal(row.email, r.body.user.email, "l'email stocké doit être la forme normalisée");
  assert.match(row.password_hash, /^\$2[aby]\$12\$/, 'le coût bcrypt doit rester 12');
  assert.equal(row.password_hash.length, 60);
  assert.ok(row.created_at instanceof Date);

  assert.equal(await bcrypt.compare(PASSWORD, row.password_hash), true);
  assert.equal(await bcrypt.compare('mauvais-mot-de-passe', row.password_hash), false);
});

test('un email déjà inscrit est refusé avec 409', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const first = await call(register, { email, password: PASSWORD, displayName: 'Supporter Test', termsAccepted: true });
  assert.equal(first.status, 201);
  createdIds.push(first.body.user.id);

  const second = await call(register, { email, password: PASSWORD, displayName: 'Autre Nom', termsAccepted: true });
  assert.equal(second.status, 409);
  assert.equal(second.cookies.length, 0);

  const rows = await query<{ n: number }>('SELECT count(*)::int AS n FROM users WHERE email = $1', [email]);
  assert.equal(rows.rows[0].n, 1, 'le doublon a malgré tout été inséré');
});

test('le compte créé peut se connecter, y compris avec un email mal saisi', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await call(register, { email, password: PASSWORD, displayName: 'Supporter Test', termsAccepted: true });
  assert.equal(created.status, 201);
  createdIds.push(created.body.user.id);

  // Majuscules et espaces : c'est exactement ce qui rendait le compte
  // placeholder historique impossible à connecter.
  const ok = await call(login, { email: `  ${email.toUpperCase()}  `, password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'user');
  assert.equal(ok.cookies.length, 1);
  assert.equal(ok.cookies[0].name, 'session');

  const wrongPassword = await call(login, { email, password: 'mauvais-mot-de-passe' });
  assert.equal(wrongPassword.status, 401);

  const unknownEmail = await call(login, { email: uniqueEmail(), password: PASSWORD });
  assert.equal(unknownEmail.status, 401);

  // Message identique que le compte existe ou non : ne pas révéler quelles
  // adresses sont inscrites.
  assert.deepEqual(wrongPassword.body, unknownEmail.body);
  assert.equal(wrongPassword.cookies.length, 0);

  const missing = await call(login, { email: '', password: '' });
  assert.equal(missing.status, 400);
});

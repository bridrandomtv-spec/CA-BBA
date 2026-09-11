/**
 * Test d'intégration de la révocation de session (token_version, migration 011).
 * Même contrat que auth-register.mts : handlers réels du routeur, base réelle,
 * skip explicite si indisponible. Lancement : npm run test:db.
 * Le nom ne porte volontairement pas le motif `.test.mts` : `npm test` lance
 * `node --test` sans argument et chargerait ce fichier sans tsx.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { authRouter } from '../../server/auth.js';
import { env } from '../../server/env.js';
import { pool, query } from '../../server/db/index.js';

type Handler = (req: any, res: any, next: unknown) => Promise<void> | void;

/**
 * Récupère TOUTE la pile de handlers d'une route POST du routeur : /logout
 * enregistre [requireAuth, handler], et tester seulement le dernier
 * reviendrait à contourner la protection qu'on veut vérifier.
 */
function routeStack(path: string): Handler[] {
  type Stack = Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }>;
  const layer = (authRouter as unknown as { stack: Stack }).stack.find(
    (l) => l.route?.path === path && l.route?.methods?.post,
  );
  if (!layer?.route) throw new Error(`handler POST ${path} introuvable dans authRouter`);
  return layer.route.stack.map((s) => s.handle as Handler);
}

const registerChain = routeStack('/register');
const loginChain = routeStack('/login');
const logoutChain = routeStack('/logout');

interface Captured {
  status: number;
  body: any;
  cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>;
  cleared: string[];
  nextCalled: boolean;
}

/**
 * Exécute une chaîne de handlers sur un même `req` mutable : requireAuth y
 * attache `req.user`, le handler suivant le trouve — exactement comme Express.
 * La valeur du cookie EST capturée (contrairement à auth-register.mts) : ce
 * test a besoin du JWT réel pour vérifier sa révocation. Elle ne quitte
 * jamais le processus de test.
 */
async function callChain(
  handlers: Handler[],
  req: { body?: unknown; cookies?: Record<string, string> },
): Promise<Captured> {
  const captured: Captured = { status: 200, body: {}, cookies: [], cleared: [], nextCalled: false };
  const res = {
    status(code: number) { captured.status = code; return res; },
    json(payload: unknown) { captured.body = payload; return res; },
    cookie(name: string, value: string, options: Record<string, unknown>) {
      captured.cookies.push({ name, value, options }); return res;
    },
    clearCookie(name: string) { captured.cleared.push(name); return res; },
    setHeader() { return res; },
  };

  const mutableReq: any = { ...req, ip: '127.0.0.1' };
  for (const handler of handlers) {
    let advanced = false;
    await handler(mutableReq, res, () => { advanced = true; captured.nextCalled = true; });
    if (!advanced) break;
  }
  return captured;
}

let skipReason: string | false = false;
try {
  await pool.query('SELECT 1 FROM users LIMIT 1');
  // La migration 011 doit être appliquée : sans token_version, requireAuth
  // échouerait en 500, pas en skip propre.
  await pool.query('SELECT token_version FROM users LIMIT 1');
} catch (error: any) {
  skipReason = `base PostgreSQL indisponible ou migration 011 non appliquée : ${error?.message ?? error}`;
}

const createdIds: string[] = [];
const uniqueEmail = () => `cabba.test.${randomUUID()}@example.com`;
const PASSWORD = 'mot-de-passe-de-test';

after(async () => {
  if (!skipReason && createdIds.length > 0) {
    await query('DELETE FROM email_log WHERE user_id = ANY($1::uuid[])', [createdIds]).catch(() => {});
    await query('DELETE FROM orders WHERE user_id = ANY($1::uuid[])', [createdIds]).catch(() => {});
    const deleted = await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdIds]);
    assert.equal(deleted.rowCount, createdIds.length, 'nettoyage incomplet : des comptes de test restent en base');
  }
  await pool.end();
});

const tokenVersionOf = async (userId: string): Promise<number> =>
  (await query<{ token_version: number }>('SELECT token_version FROM users WHERE id = $1', [userId]))
    .rows[0].token_version;

test('logout révoque la session : le cookie présenté ensuite est refusé', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Supporter Test', termsAccepted: true },
  });
  assert.equal(created.status, 201);
  const userId: string = created.body.user.id;
  createdIds.push(userId);

  const sessionCookie = created.cookies.find((c) => c.name === 'session');
  assert.ok(sessionCookie, "l'inscription doit poser un cookie de session");
  assert.equal(await tokenVersionOf(userId), 1);

  // 1. Le cookie ouvre les routes protégées : /logout atteint son handler.
  const first = await callChain(logoutChain, { cookies: { session: sessionCookie.value } });
  assert.equal(first.status, 200);
  assert.equal(first.body.success, true);
  assert.deepEqual(first.cleared, ['session'], 'le cookie doit être supprimé');
  assert.equal(await tokenVersionOf(userId), 2, 'token_version doit être incrémenté');

  // 2. Le MÊME cookie est révoqué côté serveur : même s'il a été copié avant
  //    le logout, requireAuth le refuse (401, handler jamais atteint).
  const replay = await callChain(logoutChain, { cookies: { session: sessionCookie.value } });
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error, 'Session revoked');
  assert.deepEqual(replay.cleared, ['session'], 'un jeton révoqué doit aussi nettoyer le cookie');
  assert.equal(replay.body.success, undefined, 'le handler logout ne doit pas être atteint');

  // 3. Une nouvelle connexion fonctionne et produit un cookie valide (tv = 2).
  const login = await callChain(loginChain, { body: { email, password: PASSWORD } });
  assert.equal(login.status, 200);
  const fresh = login.cookies.find((c) => c.name === 'session');
  assert.ok(fresh, 'la connexion doit poser un nouveau cookie');

  const withFresh = await callChain(logoutChain, { cookies: { session: fresh.value } });
  assert.equal(withFresh.status, 200);
  assert.equal(await tokenVersionOf(userId), 3);
});

test('un jeton signé avant la migration 011 (sans claim tv) reste accepté, puis révocable', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Legacy Session', termsAccepted: true },
  });
  assert.equal(created.status, 201);
  const userId: string = created.body.user.id;
  createdIds.push(userId);

  // Jeton « ancien format » : sub seul, pas de tv. requireAuth le traite
  // comme la version 1 (compatibilité ascendante) — sinon la migration 011
  // déconnecterait tout le monde.
  const legacyToken = jwt.sign({ sub: userId }, env.sessionSecret, { expiresIn: '1h' });

  const accepted = await callChain(logoutChain, { cookies: { session: legacyToken } });
  assert.equal(accepted.status, 200, 'un jeton sans tv doit être accepté contre token_version = 1');
  assert.equal(await tokenVersionOf(userId), 2);

  const revoked = await callChain(logoutChain, { cookies: { session: legacyToken } });
  assert.equal(revoked.status, 401);
  assert.equal(revoked.body.error, 'Session revoked');
});

test('logout sans cookie reçoit 401 sans toucher la base', { skip: skipReason }, async () => {
  const before = await query<{ n: number }>(
    'SELECT COALESCE(sum(token_version), 0)::int AS n FROM users',
  );

  const anonymous = await callChain(logoutChain, { cookies: {} });
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.error, 'Unauthorized');
  assert.equal(anonymous.cookies.length, 0);

  const afterCount = await query<{ n: number }>(
    'SELECT COALESCE(sum(token_version), 0)::int AS n FROM users',
  );
  assert.deepEqual(afterCount.rows[0], before.rows[0], 'aucune ligne ne doit être modifiée');
});

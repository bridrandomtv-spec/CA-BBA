/**
 * Test d'intégration des droits RGPD : GET /export (accès + portabilité) et
 * DELETE /account (effacement par anonymisation, migration 012).
 * Même contrat que auth-register.mts / auth-logout.mts.
 * Lancement : npm run test:db.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { authRouter } from '../../server/auth.js';
import { pool, query } from '../../server/db/index.js';

type Handler = (req: any, res: any, next: unknown) => Promise<void> | void;

function routeStack(path: string, method: 'post' | 'get' | 'delete'): Handler[] {
  type Stack = Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }>;
  const layer = (authRouter as unknown as { stack: Stack }).stack.find(
    (l) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer?.route) throw new Error(`handler ${method.toUpperCase()} ${path} introuvable dans authRouter`);
  return layer.route.stack.map((s) => s.handle as Handler);
}

const registerChain = routeStack('/register', 'post');
const exportChain = routeStack('/export', 'get');
const deleteChain = routeStack('/account', 'delete');

interface Captured {
  status: number;
  body: any;
  headers: Record<string, string>;
  cookies: Array<{ name: string; value: string }>;
  cleared: string[];
}

async function callChain(
  handlers: Handler[],
  req: { body?: unknown; cookies?: Record<string, string> },
): Promise<Captured> {
  const captured: Captured = { status: 200, body: {}, headers: {}, cookies: [], cleared: [] };
  const res = {
    status(code: number) { captured.status = code; return res; },
    json(payload: unknown) { captured.body = payload; return res; },
    cookie(name: string, value: string) { captured.cookies.push({ name, value }); return res; },
    clearCookie(name: string) { captured.cleared.push(name); return res; },
    setHeader(key: string, value: string) { captured.headers[key.toLowerCase()] = value; return res; },
  };

  const mutableReq: any = { ...req, ip: '127.0.0.1' };
  for (const handler of handlers) {
    let advanced = false;
    await handler(mutableReq, res, () => { advanced = true; });
    if (!advanced) break;
  }
  return captured;
}

let skipReason: string | false = false;
try {
  // users + colonnes des migrations 011 ET 012 requises.
  await pool.query('SELECT token_version, deleted_at FROM users LIMIT 1');
} catch (error: any) {
  skipReason = `base indisponible ou migrations 011/012 non appliquées : ${error?.message ?? error}`;
}

const createdIds: string[] = [];
const createdOrderIds: string[] = [];
const uniqueEmail = () => `cabba.test.${randomUUID()}@example.com`;
const PASSWORD = 'mot-de-passe-de-test';

after(async () => {
  if (!skipReason) {
    if (createdOrderIds.length > 0) {
      await query('DELETE FROM order_items WHERE order_id = ANY($1::uuid[])', [createdOrderIds]).catch(() => {});
      await query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [createdOrderIds]).catch(() => {});
    }
    if (createdIds.length > 0) {
      await query('DELETE FROM email_log WHERE user_id = ANY($1::uuid[])', [createdIds]).catch(() => {});
      await query('DELETE FROM orders WHERE user_id = ANY($1::uuid[])', [createdIds]).catch(() => {});
      await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdIds]).catch(() => {});
    }
  }
  await pool.end();
});

test('export : toutes les données du compte, sans secret', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'RGPD Test', termsAccepted: true },
  });
  assert.equal(created.status, 201);
  const userId: string = created.body.user.id;
  createdIds.push(userId);

  // Données associées : une publication et une commande (sans ligne produit).
  await query('INSERT INTO posts (author_id, content) VALUES ($1, $2)', [userId, 'منشور اختبار RGPD']);
  const order = await query<{ id: string }>(
    `INSERT INTO orders (user_id, total, status) VALUES ($1, 0, 'pending') RETURNING id`,
    [userId],
  );
  createdOrderIds.push(order.rows[0].id);

  const sessionCookie = created.cookies.find((c) => c.name === 'session');
  assert.ok(sessionCookie);

  const exported = await callChain(exportChain, { cookies: { session: sessionCookie.value } });
  assert.equal(exported.status, 200);
  assert.match(exported.headers['content-disposition'] ?? '', /^attachment; filename="cabba-export-/);

  assert.equal(exported.body.profile.email, email);
  assert.equal(exported.body.profile.displayName, 'RGPD Test');
  assert.equal(exported.body.posts.length, 1);
  assert.equal(exported.body.posts[0].content, 'منشور اختبار RGPD');
  assert.equal(exported.body.orders.length, 1);
  assert.deepEqual(exported.body.orders[0].items, []);
  assert.ok(exported.body.generatedAt);

  // Aucun secret dans le payload : ni hachage, ni clés push.
  const serialized = JSON.stringify(exported.body);
  assert.ok(!serialized.includes('password_hash'), 'le hachage du mot de passe ne doit jamais être exporté');
  assert.ok(!serialized.includes('"p256dh"'), 'les clés push ne doivent pas être exportées');
});

test('suppression : anonymise, préserve la comptabilité, révoque la session, libère l’email', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'À Supprimer', termsAccepted: true },
  });
  assert.equal(created.status, 201);
  const userId: string = created.body.user.id;
  createdIds.push(userId);

  await query('INSERT INTO posts (author_id, content) VALUES ($1, $2)', [userId, 'sera supprimé']);
  const order = await query<{ id: string }>(
    `INSERT INTO orders (user_id, total, status) VALUES ($1, 0, 'pending') RETURNING id`,
    [userId],
  );
  createdOrderIds.push(order.rows[0].id);

  const sessionCookie = created.cookies.find((c) => c.name === 'session');
  assert.ok(sessionCookie);

  // 1. Suppression du compte.
  const deleted = await callChain(deleteChain, { cookies: { session: sessionCookie.value } });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.success, true);
  assert.deepEqual(deleted.cleared, ['session']);

  // 2. La ligne users est anonymisée, pas supprimée (orders RESTRICT).
  const row = (
    await query<{ email: string; display_name: string; password_hash: string; deleted_at: Date | null; token_version: number }>(
      'SELECT email, display_name, password_hash, deleted_at, token_version FROM users WHERE id = $1',
      [userId],
    )
  ).rows[0];
  assert.match(row.email, /^deleted\+[0-9a-f-]{36}@deleted\.invalid$/);
  assert.equal(row.display_name, 'حساب محذوف');
  assert.equal(row.password_hash, '!', 'aucune connexion ne doit plus être possible');
  assert.ok(row.deleted_at instanceof Date);
  assert.equal(row.token_version, 2, 'la session doit être révoquée par token_version');

  // 3. Données sociales effacées, comptabilité préservée.
  const posts = await query('SELECT id FROM posts WHERE author_id = $1', [userId]);
  assert.equal(posts.rowCount, 0);
  const orders = await query('SELECT id, user_id FROM orders WHERE id = $1', [order.rows[0].id]);
  assert.equal(orders.rowCount, 1, 'la commande est une pièce comptable : elle survit au compte');
  assert.equal(orders.rows[0].user_id, userId);

  // 4. L'ancienne session est morte (export → 401).
  const replay = await callChain(exportChain, { cookies: { session: sessionCookie.value } });
  assert.equal(replay.status, 401);

  // 5. Les identifiants d'origine ne fonctionnent plus…
  const loginChain = routeStack('/login', 'post');
  const login = await callChain(loginChain, { body: { email, password: PASSWORD } });
  assert.equal(login.status, 401);

  // 6. …et l'email est libéré pour une réinscription.
  const again = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Réinscrit', termsAccepted: true },
  });
  assert.equal(again.status, 201);
  createdIds.push(again.body.user.id);
});

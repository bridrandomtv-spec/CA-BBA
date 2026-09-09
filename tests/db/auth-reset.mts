/**
 * Test d'intégration de la récupération de mot de passe (migration 017).
 * Même contrat que les autres tests/db/* : handlers réels du routeur, base
 * réelle, skip explicite si indisponible. Lancement : npm run test:db.
 * Le nom ne porte volontairement pas le motif `.test.mts` : `npm test`
 * (node --test) ne peut pas charger du TypeScript sans tsx.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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
const loginChain = routeStack('/login', 'post');
const forgotChain = routeStack('/forgot-password', 'post');
const resetChain = routeStack('/reset-password', 'post');

interface Captured {
  status: number;
  body: any;
  cookies: Array<{ name: string; value: string }>;
  cleared: string[];
}

async function callChain(
  handlers: Handler[],
  req: { body?: unknown; cookies?: Record<string, string> },
): Promise<Captured> {
  const captured: Captured = { status: 200, body: {}, cookies: [], cleared: [] };
  const res = {
    status(code: number) { captured.status = code; return res; },
    json(payload: unknown) { captured.body = payload; return res; },
    cookie(name: string, value: string) { captured.cookies.push({ name, value }); return res; },
    clearCookie(name: string) { captured.cleared.push(name); return res; },
    setHeader() { return res; },
  };
  const mutableReq: any = { ...req, ip: '127.0.0.1' };
  for (const handler of handlers) {
    let advanced = false;
    await handler(mutableReq, res, () => { advanced = true; });
    if (!advanced) break;
  }
  return captured;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

let skipReason: string | false = false;
try {
  await pool.query('SELECT 1 FROM password_reset_tokens LIMIT 1');
} catch (error: any) {
  skipReason = `base indisponible ou migration 017 non appliquée : ${error?.message ?? error}`;
}

const createdIds: string[] = [];
const uniqueEmail = () => `cabba.test.${randomUUID()}@example.com`;
const PASSWORD = 'mot-de-passe-de-test';

after(async () => {
  if (!skipReason && createdIds.length > 0) {
    await query('DELETE FROM email_log WHERE user_id = ANY($1::uuid[])', [createdIds]).catch(() => {});
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdIds]).catch(() => {});
  }
  await pool.end();
});

test('forgot-password : réponse générique, jeton haché, expiration 30 min', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Reset Test' },
  });
  assert.equal(created.status, 201);
  createdIds.push(created.body.user.id);

  // Adresse inconnue : même 200 générique qu'une adresse connue — aucune
  // énumération possible.
  const unknown = await callChain(forgotChain, { body: { email: uniqueEmail() } });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.success, true);

  const known = await callChain(forgotChain, { body: { email } });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body, 'la réponse doit être strictement identique');

  // Un jeton est bien créé : haché SHA-256 (64 hex), jamais en clair,
  // expiration ~30 minutes, non consommé.
  const rows = await query<{ token_hash: string; expires_at: Date; used_at: Date | null }>(
    'SELECT token_hash, expires_at, used_at FROM password_reset_tokens WHERE user_id=$1',
    [created.body.user.id],
  );
  assert.equal(rows.rowCount, 1);
  assert.match(rows.rows[0].token_hash, /^[0-9a-f]{64}$/);
  assert.equal(rows.rows[0].used_at, null);
  const ttlMin = (rows.rows[0].expires_at.getTime() - Date.now()) / 60_000;
  assert.ok(ttlMin > 25 && ttlMin <= 31, `expiration inattendue : ${ttlMin} min`);
});

test('forgot-password : une nouvelle demande invalide le lien précédent', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Reset Test 2' },
  });
  createdIds.push(created.body.user.id);

  await callChain(forgotChain, { body: { email } });
  await callChain(forgotChain, { body: { email } });

  const active = await query(
    'SELECT COUNT(*)::int AS n FROM password_reset_tokens WHERE user_id=$1 AND used_at IS NULL',
    [created.body.user.id],
  );
  assert.equal(active.rows[0].n, 1, 'un seul lien doit rester valide');
});

test('reset-password : change le mot de passe, consomme le jeton, révoque les sessions', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Reset Test 3' },
  });
  createdIds.push(created.body.user.id);
  const userId: string = created.body.user.id;

  // L'email n'est pas intercepté par le test : on forge un jeton connu
  // directement en base, au format exact produit par la route (hex 64,
  // SHA-256 stocké).
  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
    [userId, sha256(token)],
  );

  // Mauvais jeton → 400.
  const wrong = await callChain(resetChain, { body: { token: 'pas-le-bon-jeton', password: 'nouveau-mot-de-passe' } });
  assert.equal(wrong.status, 400);

  // Bon jeton → 200, cookie supprimé.
  const reset = await callChain(resetChain, { body: { token, password: 'nouveau-mot-de-passe' } });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.success, true);
  assert.ok(reset.cleared.includes('session'));

  // Ancien mot de passe mort, nouveau opérationnel.
  const oldLogin = await callChain(loginChain, { body: { email, password: PASSWORD } });
  assert.equal(oldLogin.status, 401);
  const newLogin = await callChain(loginChain, { body: { email, password: 'nouveau-mot-de-passe' } });
  assert.equal(newLogin.status, 200);

  // Rejeu du même jeton → 400 (usage unique).
  const replay = await callChain(resetChain, { body: { token, password: 'encore-un-autre-mot' } });
  assert.equal(replay.status, 400);

  // Sessions révoquées : token_version incrémenté (un cookie copié avant le
  // reset est mort — vérifié par la suite auth-logout).
  const row = await query<{ token_version: number }>('SELECT token_version FROM users WHERE id=$1', [userId]);
  assert.equal(row.rows[0].token_version, 2);
});

test('reset-password : jeton expiré refusé', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Reset Test 4' },
  });
  createdIds.push(created.body.user.id);

  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
    [created.body.user.id, sha256(token)],
  );

  const expired = await callChain(resetChain, { body: { token, password: 'nouveau-mot-de-passe' } });
  assert.equal(expired.status, 400);
});

test('reset-password : mot de passe court refusé SANS consommer le jeton', { skip: skipReason }, async () => {
  const email = uniqueEmail();
  const created = await callChain(registerChain, {
    body: { email, password: PASSWORD, displayName: 'Reset Test 5' },
  });
  createdIds.push(created.body.user.id);

  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
    [created.body.user.id, sha256(token)],
  );

  const short = await callChain(resetChain, { body: { token, password: 'court' } });
  assert.equal(short.status, 400);

  // Le jeton doit rester utilisable : la validation du mot de passe précède
  // la consommation du lien (sinon une faute de frappe grillerait l'email).
  const stillValid = await query(
    'SELECT COUNT(*)::int AS n FROM password_reset_tokens WHERE user_id=$1 AND used_at IS NULL',
    [created.body.user.id],
  );
  assert.equal(stillValid.rows[0].n, 1);
});

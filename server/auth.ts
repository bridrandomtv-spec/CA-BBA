/**
 * Authentification par cookie de session signé (JWT).
 *
 * Principes appliqués ici :
 *
 *  1. **Le jeton ne porte que l'identifiant et la version de session.**
 *     Le rôle est relu en base à chaque requête : un compte rétrogradé perd
 *     ses droits immédiatement, pas à l'expiration du jeton.
 *
 *  2. **Révocation par `token_version` (migration 011).** Le claim `tv` est
 *     comparé à la colonne : logout, suppression de compte (migration 012)
 *     ou reset manuel incrémentent la colonne et tuent toutes les sessions
 *     existantes — un cookie volé ne survit pas à une déconnexion.
 *
 *  3. **`requireAdmin` vérifie aussi l'authentification**, composé en un
 *     seul RequestHandler (le typage contextuel des handlers suivants est
 *     préservé, contrairement à un export en tableau).
 *
 *  4. **Mots de passe compromis refusés à l'inscription** (HIBP k-anonymity,
 *     server/passwords.ts) — fail-open : une panne du fournisseur ne bloque
 *     pas les inscriptions.
 *
 *  5. **Droits RGPD** : GET /export (accès + portabilité, sans secret) et
 *     DELETE /account (effacement par anonymisation — les commandes, pièces
 *     comptables en ON DELETE RESTRICT, survivent déliées de toute identité).
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from './db/index.js';
import { env } from './env.js';
import { sendWelcomeEmail, sendEmail, passwordResetEmail } from './email.js';
import { isPasswordCompromised } from './passwords.js';

export const authRouter = Router();

// Le secret est validé au démarrage par server/env.ts : plus de valeur de
// repli publiée dans le dépôt.
const JWT_SECRET = env.sessionSecret;

/** Durée de vie de la session, partagée entre le jeton et le cookie. */
const SESSION_DAYS = 7;
const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Coût du hachage bcrypt. 12 tours ≈ 250 ms sur un serveur modeste. */
export const BCRYPT_ROUNDS = 12;

/** Longueur minimale d'un mot de passe à l'inscription. */
export const MIN_PASSWORD_LENGTH = 12;

/** Rôles acceptés, alignés sur la contrainte CHECK de la table users. */
export const ROLES = ['user', 'admin', 'scanner'] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Colonnes renvoyées par toutes les requêtes utilisateur, en un seul endroit.
 * `token_version` est inclus pour la vérification de session mais n'est
 * jamais exposé au client (toAuthUser ne le mappe pas).
 */
const USER_COLUMNS = 'id, email, display_name, avatar_url, role, created_at, token_version';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  created_at: Date;
  token_version: number;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at,
  };
}

/**
 * Les adresses sont comparées en minuscules et sans espaces de bord, sinon
 * « Ali@example.com » et « ali@example.com » créent deux comptes distincts
 * malgré la contrainte d'unicité.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Contrôle volontairement simple : une arobase entourée de texte sans espace. */
export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const setSessionCookie = (res: Response, userId: string, tokenVersion: number) => {
  // Charge utile minimale : `sub` + `tv` (version de session). Tout le reste
  // (nom, rôle, avatar) est relu en base, donc jamais périmé et jamais
  // falsifiable côté client.
  const token = jwt.sign({ sub: userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie('session', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  });
};

const clearSessionCookie = (res: Response) => {
  res.clearCookie('session', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
  });
};

/** Durée de validité du lien de réinitialisation envoyé par email. */
const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Le jeton de réinitialisation (256 bits aléatoires) n'est JAMAIS stocké en
 * clair : seule son empreinte SHA-256 va en base (migration 017). Un vol de
 * la base ne révèle donc aucun lien utilisable.
 */
const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Vérifie le cookie de session et charge l'utilisateur depuis la base.
 * Une requête SQL par appel : c'est le prix de la révocation immédiate des
 * droits et des sessions.
 */
export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.session;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let userId: string;
  let tokenVersion: unknown;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: unknown; tv?: unknown };
    if (typeof decoded.sub !== 'string') throw new Error('sub manquant');
    userId = decoded.sub;
    tokenVersion = decoded.tv;
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  // Jeton signé avant la migration 011 (pas de claim `tv`) : accepté contre
  // la version 1, le temps que les sessions pré-migration expirent.
  const expectedVersion = typeof tokenVersion === 'number' ? tokenVersion : 1;

  try {
    // deleted_at IS NULL : un compte anonymisé (RGPD) ne ressuscite pas via
    // un ancien cookie.
    const result = await query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (result.rows.length === 0) {
      // Compte supprimé/anonymisé alors qu'une session était encore ouverte.
      clearSessionCookie(res);
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const row = result.rows[0];

    if (row.token_version !== expectedVersion) {
      // Session révoquée côté serveur (logout, suppression, reset…).
      clearSessionCookie(res);
      res.status(401).json({ error: 'Session revoked' });
      return;
    }

    req.user = toAuthUser(row);
    next();
  } catch (error) {
    console.error('[CABBA] échec du chargement de la session :', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Second maillon de `requireAdmin` : suppose `requireAuth` déjà passé. */
const ensureAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admins only' });
    return;
  }
  next();
};

/**
 * À monter tel quel sur une route réservée aux administrateurs :
 * `router.post('/', requireAdmin, handler)`.
 */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  let authenticated = false;
  // Callback intermédiaire : transmettre le `next` d'Express à requireAuth
  // enchaînerait directement sur le handler et court-circuiterait le contrôle
  // admin.
  await requireAuth(req, res, () => {
    authenticated = true;
  });
  if (!authenticated) return;
  ensureAdmin(req, res, next);
};

authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string') {
      res.status(400).json({ error: 'الحقول المطلوبة ناقصة.' });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const trimmedName = displayName.trim();

    if (!normalizedEmail || !trimmedName || !password) {
      res.status(400).json({ error: 'الحقول المطلوبة ناقصة.' });
      return;
    }

    if (!isEmailShaped(normalizedEmail)) {
      res.status(400).json({ error: 'البريد الإلكتروني غير صالح.' });
      return;
    }

    // Contrôle côté serveur : le `required` du formulaire ne protège de rien,
    // l'API étant appelable directement.
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`,
      });
      return;
    }

    // HIBP (k-anonymity) : refuse les mots de passe présents dans des fuites
    // connues. `null` = vérification impossible → fail-open journalisé.
    const compromised = await isPasswordCompromised(password);
    if (compromised === true) {
      res.status(400).json({
        error: 'كلمة المرور هذه ظهرت في تسريبات بيانات سابقة ويسهل تخمينها. اختر كلمة مرور مختلفة: 12 حرفاً على الأقل، مزيج من أحرف وأرقام ورموز.',
      });
      return;
    }

    if (trimmedName.length > 100) {
      res.status(400).json({ error: 'الاسم طويل جداً.' });
      return;
    }

    // Pack crédibilité : pas de compte sans consentement explicite
    // aux conditions d'utilisation et à la politique de confidentialité.
    if (req.body?.termsAccepted !== true) {
      res.status(400).json({ error: 'الموافقة على شروط الاستخدام وسياسة الخصوصية مطلوبة لإنشاء حساب.' });
      return;
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'البريد الإلكتروني مستعمل بالفعل.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Le rôle est écrit en dur : un `role` envoyé dans le corps de la requête
    // ne doit jamais pouvoir créer un administrateur. token_version vaut 1
    // (défaut de la colonne) et est signé dans le cookie de session.
    const result = await query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name, role, terms_accepted_at)
       VALUES ($1, $2, $3, 'user', NOW())
       RETURNING ${USER_COLUMNS}`,
      [normalizedEmail, passwordHash, trimmedName],
    );

    const row = result.rows[0];
    // Pack crédibilité : preuve horodatée du consentement loi 18-07,
    // transmise par le client d'inscription (case à cocher).
    if (req.body?.consent === true) {
      await query('UPDATE users SET consent_at = NOW() WHERE id = $1', [row.id]);
    }
    const user = toAuthUser(row);
    setSessionCookie(res, user.id, row.token_version);
    res.status(201).json({ user });

    // L'envoi est volontairement asynchrone : une panne du fournisseur email
    // ne doit jamais transformer une inscription réussie en erreur HTTP.
    void sendWelcomeEmail({ id: user.id, email: user.email, displayName: user.displayName }).catch((error) => {
      console.error('[CABBA] welcome email:', error?.message ?? error);
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      res.status(400).json({ error: 'أدخل البريد الإلكتروني وكلمة المرور.' });
      return;
    }

    const result = await query<UserRow & { password_hash: string }>(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [normalizeEmail(email)],
    );

    // Message et temps de réponse identiques que le compte existe ou non :
    // comparer un hachage factice évite de révéler par la durée de la réponse
    // quelles adresses sont inscrites.
    const row = result.rows[0];
    const hash = row?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const isMatch = await bcrypt.compare(password, hash);

    if (!row || !isMatch) {
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      return;
    }

    const user = toAuthUser(row);
    setSessionCookie(res, user.id, row.token_version);
    res.json({ user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Le logout est authentifié et incrémente token_version : révoque côté
// serveur tous les jetons émis pour ce compte. Un appel sans cookie reçoit
// 401 ; le client (AuthContext.logout) nettoie quand même son état local.
authRouter.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user!.id]);
    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Le cookie est supprimé même si la révocation en base échoue : la
    // session reste révoquable au prochain appel, l'utilisateur n'est pas
    // bloqué.
    clearSessionCookie(res);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

authRouter.patch('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { displayName, avatarUrl } = req.body ?? {};
    const userId = req.user!.id;

    // Requête construite par accumulation de fragments, mais les valeurs
    // passent toutes par des paramètres numérotés : pas d'interpolation.
    const fragments: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) {
        res.status(400).json({ error: 'الاسم لا يمكن أن يكون فارغاً.' });
        return;
      }
      if (displayName.trim().length > 100) {
        res.status(400).json({ error: 'الاسم طويل جداً.' });
        return;
      }
      params.push(displayName.trim());
      fragments.push(`display_name = $${params.length}`);
    }

    if (avatarUrl !== undefined) {
      if (avatarUrl !== null && typeof avatarUrl !== 'string') {
        res.status(400).json({ error: 'صورة الملف الشخصي غير صالحة.' });
        return;
      }
      params.push(avatarUrl);
      fragments.push(`avatar_url = $${params.length}`);
    }

    if (params.length === 0) {
      res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
      return;
    }

    params.push(userId);

    const result = await query<UserRow>(
      `UPDATE users SET ${fragments.join(', ')}
       WHERE id = $${params.length}
       RETURNING ${USER_COLUMNS}`,
      params as unknown[],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Pas besoin de rafraîchir le cookie : `sub` et `tv` ne changent pas lors
    // d'une mise à jour de profil.
    res.json({ user: toAuthUser(result.rows[0]) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/export — droit d'accès et portabilité (RGPD art. 15 & 20).
 * Retourne toutes les données rattachées au compte. Deux exclusions
 * volontaires : `password_hash` (secret) et `p256dh`/`auth` des abonnements
 * push (matériel cryptographique d'appareil, sensible et inutile).
 */
authRouter.get('/export', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [ordersResult, orderItemsResult, membershipsResult, postsResult, commentsResult, likesResult, mediaResult, pushResult, pushLogResult] =
      await Promise.all([
        query('SELECT id, total, status, created_at, updated_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
        query(
          `SELECT oi.order_id, oi.product_name, oi.quantity, oi.unit_price
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.user_id = $1`,
          [userId],
        ),
        query('SELECT id, member_number, type, status, start_date, expiration_date, created_at FROM memberships WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
        query('SELECT id, content, image_url, created_at FROM posts WHERE author_id = $1 ORDER BY created_at DESC', [userId]),
        query('SELECT id, post_id, content, created_at FROM post_comments WHERE author_id = $1 ORDER BY created_at DESC', [userId]),
        query('SELECT post_id, created_at FROM post_likes WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
        query('SELECT id, object_key, original_name, content_type, size_bytes, kind, status, created_at FROM media_assets WHERE owner_id = $1 ORDER BY created_at DESC', [userId]),
        query('SELECT id, endpoint, goals, matches, team_news, final_scores, created_at FROM push_subscriptions WHERE user_id = $1', [userId]),
        query('SELECT category, event_key, created_at FROM push_notification_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [userId]),
      ]);

    // email_log peut être vide selon l'installation : l'export se dégrade
    // proprement plutôt que de renvoyer 500.
    const emailRows = await query('SELECT * FROM email_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId])
      .then((result) => result.rows)
      .catch(() => []);

    const orders = ordersResult.rows.map((order) => ({
      ...order,
      items: orderItemsResult.rows.filter((item) => item.order_id === order.id),
    }));

    res.setHeader('Content-Disposition', `attachment; filename="cabba-export-${userId}.json"`);
    res.json({
      generatedAt: new Date().toISOString(),
      profile: req.user,
      orders,
      memberships: membershipsResult.rows,
      posts: postsResult.rows,
      postComments: commentsResult.rows,
      postLikes: likesResult.rows,
      media: mediaResult.rows,
      pushSubscriptions: pushResult.rows,
      pushLog: pushLogResult.rows,
      emailLog: emailRows,
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/auth/account — droit à l'effacement (RGPD art. 17).
 * Anonymisation en UNE transaction : données sociales supprimées, ligne
 * users rendue non-identifiante, token_version incrémenté (toute session
 * ouverte meurt immédiatement). Les commandes sont CONSERVÉES (pièces
 * comptables, ON DELETE RESTRICT) mais déliées de toute identité. L'email
 * libéré (`deleted+<uuid>@deleted.invalid`, unique par construction) permet
 * au supporter de se réinscrire avec son adresse d'origine.
 */
authRouter.delete('/account', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    await withTransaction(async (exec) => {
      // La ligne users n'étant pas supprimée, les ON DELETE CASCADE ne se
      // déclenchent pas : chaque table enfant est nettoyée explicitement.
      await exec('DELETE FROM push_notification_log WHERE user_id = $1', [userId]);
      await exec('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
      await exec('DELETE FROM media_assets WHERE owner_id = $1', [userId]);
      await exec('DELETE FROM memberships WHERE user_id = $1', [userId]);
      await exec('DELETE FROM post_likes WHERE user_id = $1', [userId]);
      await exec('DELETE FROM post_comments WHERE author_id = $1', [userId]);
      await exec('DELETE FROM posts WHERE author_id = $1', [userId]);
      await exec('DELETE FROM email_log WHERE user_id = $1', [userId]);
      // orders / order_items : volontairement CONSERVÉS (comptabilité).

      await exec(
        `UPDATE users
         SET email = 'deleted+' || id || '@deleted.invalid',
             display_name = 'حساب محذوف',
             avatar_url = NULL,
             password_hash = '!',
             deleted_at = NOW(),
             token_version = token_version + 1
         WHERE id = $1`,
        [userId],
      );
      // password_hash = '!' : aucune saisie ne peut plus correspondre.
    });

    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * POST /api/auth/forgot-password — demande de lien de réinitialisation.
 *
 * Réponse volontairement GÉNÉRIQUE et identique dans tous les cas (compte
 * existant ou non, erreur interne) : la route ne doit jamais révéler quelles
 * adresses sont inscrites. Le rate limit authRateLimit (20/15 min) est monté
 * côté server.ts — sans lui, la route deviendrait un outil de bombardement
 * d'emails.
 */
authRouter.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const generic = { success: true };
  try {
    const { email } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim()) {
      res.json(generic);
      return;
    }
    const normalizedEmail = normalizeEmail(email);

    const result = await query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail],
    );
    const row = result.rows[0];
    if (!row) {
      res.json(generic);
      return;
    }

    // Une nouvelle demande invalide les liens précédents encore valides :
    // seul le dernier email reçu fonctionne — limite la fenêtre d'un lien égaré.
    await query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [row.id],
    );

    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [row.id, hashResetToken(token), String(RESET_TOKEN_TTL_MINUTES)],
    );

    // Envoi asynchrone et best-effort : comme le bienvenu, une panne du
    // fournisseur email ne doit pas trahir l'existence du compte via un 500.
    const base = (env.appBaseUrl ?? '').replace(/\/$/, '');
    const resetUrl = `${base}/reset-password?token=${token}`;
    const content = passwordResetEmail(row.display_name, resetUrl);
    void sendEmail({
      userId: row.id,
      to: row.email,
      subject: content.subject,
      html: content.html,
      kind: 'password_reset',
      // event_key unique par demande : la déduplication Resend n'écrase pas
      // un lien précédent encore valide côté boîte mail.
      eventKey: `password-reset:${row.id}:${hashResetToken(token).slice(0, 16)}`,
    }).catch((error) => {
      console.error('[CABBA] password reset email:', error?.message ?? error);
    });

    res.json(generic);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Même en cas d'erreur interne : réponse générique, jamais d'indice.
    res.json(generic);
  }
});

/**
 * POST /api/auth/reset-password — consommation du lien reçu par email.
 * Chaîne de vérifications : jeton haché présent, non utilisé, non expiré →
 * longueur minimale → HIBP → changement en transaction avec révocation de
 * TOUTES les sessions (token_version) : un cookie volé ne survit pas au reset.
 */
authRouter.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || !token || typeof password !== 'string') {
      res.status(400).json({ error: 'الرابط أو كلمة المرور غير صالحة.' });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `كلمة المرور يجب أن تحتوي على ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`,
      });
      return;
    }

    // Une réinitialisation n'est pas une raison pour accepter un mot de
    // passe compromis (même politique qu'à l'inscription, fail-open).
    const compromised = await isPasswordCompromised(password);
    if (compromised === true) {
      res.status(400).json({
        error: 'كلمة المرور هذه ظهرت في تسريبات بيانات سابقة ويسهل تخمينها. اختر كلمة مرور مختلفة: 12 حرفاً على الأقل، مزيج من أحرف وأرقام ورموز.',
      });
      return;
    }

    const tokenResult = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [hashResetToken(token)],
    );
    const resetRow = tokenResult.rows[0];
    if (!resetRow) {
      res.status(400).json({ error: 'الرابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Transaction : mot de passe changé + jeton consommé + sessions révoquées.
    const updated = await withTransaction(async (exec) => {
      await exec('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetRow.id]);
      return exec(
        `UPDATE users
         SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL`,
        [passwordHash, resetRow.user_id],
      );
    });

    if ((updated.rowCount ?? 0) === 0) {
      // Compte anonymisé (RGPD) entre l'émission du lien et son usage.
      res.status(400).json({ error: 'الحساب غير متاح.' });
      return;
    }

    clearSessionCookie(res);
    res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

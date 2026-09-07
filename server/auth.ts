/**
 * Authentification par cookie de session signé (JWT).
 *
 * Deux principes appliqués ici :
 *
 *  1. **Le jeton ne porte que l'identifiant.** L'ancienne version signait
 *     l'utilisateur entier, rôle compris. Un compte rétrogradé gardait donc ses
 *     droits d'administrateur pendant sept jours, jusqu'à l'expiration du
 *     jeton. Le rôle est désormais relu en base à chaque requête.
 *
 *  2. **`requireAdmin` vérifie aussi l'authentification.** Il lisait
 *     `req.user?.role` sans que `requireAuth` ait forcément été monté avant :
 *     sur une route mal câblée, `req.user` valait `undefined`, la comparaison
 *     échouait et renvoyait 403 — le bon refus, mais par accident. Les deux
 *     contrôles sont maintenant liés et ne peuvent plus être dissociés.
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db/index.js';
import { env } from './env.js';
import { sendWelcomeEmail } from './email.js';

export const authRouter = Router();

// Le secret est validé au démarrage par server/env.ts : plus de valeur de repli
// publiée dans le dépôt, avec laquelle n'importe qui pouvait forger un cookie
// de session portant `role: "admin"`.
const JWT_SECRET = env.sessionSecret;

/** Durée de vie de la session, partagée entre le jeton et le cookie. */
const SESSION_DAYS = 7;
const SESSION_MAX_AGE_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Coût du hachage bcrypt. 12 tours ≈ 250 ms sur un serveur modeste. */
const BCRYPT_ROUNDS = 12;

/** Longueur minimale d'un mot de passe à l'inscription. */
const MIN_PASSWORD_LENGTH = 8;

/** Rôles acceptés, alignés sur la contrainte CHECK de la table users. */
export const ROLES = ['user', 'admin'] as const;
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

/** Colonnes renvoyées par toutes les requêtes utilisateur, en un seul endroit. */
const USER_COLUMNS = 'id, email, display_name, avatar_url, role, created_at';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  created_at: Date;
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
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Contrôle volontairement simple : une arobase entourée de texte sans espace. */
function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const setSessionCookie = (res: Response, userId: string) => {
  // Charge utile minimale : `sub` seul. Tout le reste (nom, rôle, avatar) est
  // relu en base, donc jamais périmé et jamais falsifiable côté client.
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
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

/**
 * Vérifie le cookie de session et charge l'utilisateur depuis la base.
 *
 * Une requête SQL par appel : c'est le prix de la révocation immédiate des
 * droits. Sur cette application, le volume ne le justifie pas d'optimiser.
 */
export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.session;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: unknown };
    if (typeof decoded.sub !== 'string') throw new Error('sub manquant');
    userId = decoded.sub;
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  try {
    const result = await query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);

    if (result.rows.length === 0) {
      // Compte supprimé alors qu'une session était encore ouverte.
      clearSessionCookie(res);
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    req.user = toAuthUser(result.rows[0]);
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
 * `router.post('/', requireAdmin, handler)`. Les deux contrôles restent
 * inséparables, mais composés en un seul handler plutôt qu'exportés en tableau :
 * un tableau passé comme argument unique fait perdre à TypeScript le typage
 * contextuel de `req`/`res` sur le handler suivant.
 */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  let authenticated = false;
  // Callback intermédiaire : transmettre le `next` d'Express à requireAuth
  // enchaînerait directement sur le handler et court-circuiterait le contrôle admin.
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
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const trimmedName = displayName.trim();

    if (!normalizedEmail || !trimmedName || !password) {
      res.status(400).json({ error: 'Missing required fields' });
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

    if (trimmedName.length > 100) {
      res.status(400).json({ error: 'الاسم طويل جداً.' });
      return;
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Le rôle est écrit en dur : un `role` envoyé dans le corps de la requête
    // ne doit jamais pouvoir créer un administrateur.
    const result = await query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING ${USER_COLUMNS}`,
      [normalizedEmail, passwordHash, trimmedName],
    );

    const user = toAuthUser(result.rows[0]);
    setSessionCookie(res, user.id);
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
      res.status(400).json({ error: 'Missing credentials' });
      return;
    }

    const result = await query<UserRow & { password_hash: string }>(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
      [normalizeEmail(email)],
    );

    // Message et temps de réponse identiques que le compte existe ou non :
    // comparer un hachage factice évite de révéler par la durée de la réponse
    // quelles adresses sont inscrites.
    const row = result.rows[0];
    const hash = row?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const isMatch = await bcrypt.compare(password, hash);

    if (!row || !isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = toAuthUser(row);
    setSessionCookie(res, user.id);
    res.json({ user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ success: true });
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

    // Plus besoin de rafraîchir le cookie : il ne contient que l'identifiant,
    // et les données du profil sont relues en base à chaque requête.
    res.json({ user: toAuthUser(result.rows[0]) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

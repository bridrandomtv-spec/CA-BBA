import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { logAdmin } from '../auditLog.js';
import { query } from '../db/index.js';
import { requireAdmin, BCRYPT_ROUNDS, normalizeEmail, isEmailShaped } from '../auth.js';
import { sendEmail, passwordResetEmail } from '../email.js';
import { env } from '../env.js';

export const usersRouter = Router();

/** Même empreinte SHA-256 que hashResetToken() dans auth.ts (jetons d'invitation). */
const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const INVITE_TTL_MINUTES = 30;

/**
 * GET /api/users — liste admin.
 * Les comptes anonymisés (deleted_at) sont MASQUÉS par défaut : un admin ne
 * voit que les comptes vivants, sauf ?includeDeleted=1 explicite.
 */
usersRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === '1';
    const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const result = await query(
      `SELECT id,email,display_name,avatar_url,role,created_at,deleted_at FROM users ${where} ORDER BY created_at DESC`,
    );
    res.json({
      users: result.rows.map((r: any) => ({
        uid: r.id, id: r.id, email: r.email, displayName: r.display_name,
        avatarUrl: r.avatar_url, role: r.role, createdAt: r.created_at, deletedAt: r.deleted_at,
      })),
    });
  } catch (error) { console.error('[CABBA] users:', error); res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * POST /api/users — création par un admin, SANS mot de passe en clair :
 * le compte naît avec un secret aléatoire inutilisable, et un lien
 * d'invitation (reset à usage unique, 30 min) est rendu à l'admin ET
 * envoyé par email best-effort. Le rôle admin ne se crée pas ici :
 * promotion via PATCH /:id/role (garde anti-auto-rétrogradation).
 */
usersRouter.post('/', requireAdmin, async (req, res) => {
  const { email, displayName, role } = req.body ?? {};
  if (typeof email !== 'string' || !isEmailShaped(email)) {
    res.status(400).json({ error: 'بريد إلكتروني غير صالح.' });
    return;
  }
  const normalizedEmail = normalizeEmail(email);
  if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 100) {
    res.status(400).json({ error: 'الاسم مطلوب (100 حرف كحد أقصى).' });
    return;
  }
  const chosenRole = role === 'scanner' ? 'scanner' : 'user';
  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      res.status(409).json({ error: 'البريد الإلكتروني مستعمل بالفعل.' });
      return;
    }
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    const created = await query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [normalizedEmail, passwordHash, displayName.trim(), chosenRole],
    );
    const userId = created.rows[0].id as string;
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [userId, hashResetToken(token), String(INVITE_TTL_MINUTES)],
    );
    const base = (env.appBaseUrl ?? '').replace(/\/$/, '');
    const inviteUrl = `${base}/reset-password?token=${token}`;
    void sendEmail({
      userId,
      to: normalizedEmail,
      subject: 'دعوة للانضمام إلى منصة نادي شباب أهلي برج بوعريريج',
      html: passwordResetEmail(displayName.trim(), inviteUrl).html,
      kind: 'password_reset',
      eventKey: `invite:${userId}:${hashResetToken(token).slice(0, 16)}`,
    }).catch((error) => {
      console.error('[CABBA] invite email:', error?.message ?? error);
    });
    void logAdmin(req.user, 'user.create', userId, normalizedEmail);
    res.status(201).json({
      user: { uid: userId, email: normalizedEmail, displayName: displayName.trim(), role: chosenRole },
      inviteUrl,
    });
  } catch (error) { console.error('[CABBA] user create:', error); res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * DELETE /api/users/:id — anonymisation côté admin : même contrat que
 * l'auto-suppression (RGPD) — enfants nettoyés, orders conservées
 * (comptabilité), ligne users anonymisée. Interdit sur soi-même.
 */
usersRouter.delete('/:id', requireAdmin, async (req, res) => {
  const target = String(req.params.id);
  if (target === req.user!.id) {
    res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte ici.' });
    return;
  }
  try {
    const sel = await query('SELECT id, deleted_at FROM users WHERE id = $1', [target]);
    if (!sel.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    if (sel.rows[0].deleted_at) { res.status(409).json({ error: 'Compte déjà anonymisé.' }); return; }
    await query('DELETE FROM push_notification_log WHERE user_id = $1', [target]);
    await query('DELETE FROM push_subscriptions WHERE user_id = $1', [target]);
    await query('DELETE FROM media_assets WHERE user_id = $1', [target]);
    await query('DELETE FROM memberships WHERE user_id = $1', [target]);
    await query('DELETE FROM post_likes WHERE user_id = $1', [target]);
    await query('DELETE FROM post_comments WHERE author_id = $1', [target]);
    await query('DELETE FROM posts WHERE user_id = $1', [target]);
    await query('DELETE FROM email_log WHERE user_id = $1', [target]);
    await query(
      `UPDATE users
       SET email = 'deleted+' || id || '@deleted.invalid',
           display_name = 'حساب محذوف',
           avatar_url = NULL,
           password_hash = '!',
           deleted_at = NOW(),
           token_version = token_version + 1
       WHERE id = $1`,
      [target],
    );
    void logAdmin(req.user, 'user.delete', target, '');
    res.json({ success: true });
  } catch (error) { console.error('[CABBA] user delete:', error); res.status(500).json({ error: 'Internal server error' }); }
});

usersRouter.patch('/:id/role', requireAdmin, async (req, res) => {
  const role = req.body?.role;
  if (!['user', 'admin', 'scanner'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  if (req.params.id === req.user!.id) { res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' }); return; }
  try {
    const result = await query('UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 RETURNING id,role', [role, req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'User not found' }); return; }
    void logAdmin(req.user,'user.role', String(req.params.id), role);
    res.json({ success: true, user: { uid: result.rows[0].id, role: result.rows[0].role } });
  } catch (error) { console.error('[CABBA] role:', error); res.status(500).json({ error: 'Internal server error' }); }
});

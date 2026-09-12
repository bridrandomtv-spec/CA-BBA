// fidélité du Jarrad — solde, palier, historique ; top fans (admin)
// et gratification manuelle (admin) pour les animations de derby.

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { tierOf } from '../loyaltyLog.js';

export const loyaltyRouter = Router();

loyaltyRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const total = await query(
      `SELECT COALESCE(SUM(delta),0)::int AS total FROM loyalty_ledger WHERE user_id=$1`,
      [req.user!.id],
    );
    const entries = await query(
      `SELECT delta, reason, ref, created_at FROM loyalty_ledger
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id],
    );
    const t = Number(total.rows[0].total);
    res.json({
      total: t,
      tier: tierOf(t),
      entries: entries.rows.map((r: any) => ({
        delta: Number(r.delta),
        reason: r.reason,
        ref: r.ref,
        at: new Date(r.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CABBA] loyalty me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.get('/top', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT l.user_id, u.display_name, COALESCE(SUM(l.delta),0)::int AS total
       FROM loyalty_ledger l JOIN users u ON u.id = l.user_id
       GROUP BY l.user_id, u.display_name
       ORDER BY total DESC LIMIT 10`,
    );
    res.json({
      top: result.rows.map((r: any) => ({
        userId: r.user_id, name: r.display_name, total: Number(r.total), tier: tierOf(Number(r.total)),
      })),
    });
  } catch (error) {
    console.error('[CABBA] loyalty top:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.post('/grant', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.body?.userId ?? '');
    const delta = Number(req.body?.delta);
    const reason = String(req.body?.reason ?? 'grant').slice(0, 60);
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000) {
      res.status(400).json({ error: 'Gratification invalide.' });
      return;
    }
    const exists = await query('SELECT id FROM users WHERE id=$1', [userId]);
    if (!exists.rows.length) { res.status(404).json({ error: 'المستخدم غير موجود.' }); return; }
    await query(
      `INSERT INTO loyalty_ledger (user_id, delta, reason, ref) VALUES ($1,$2,$3,$4)`,
      [userId, delta, reason, 'admin'],
    );
    res.status(201).json({ granted: true });
  } catch (error) {
    console.error('[CABBA] loyalty grant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

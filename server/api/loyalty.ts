// وفاء الجراد — routes : mon solde + palier, classement des plus
// fidèles, et grant admin (geste commercial / événement).

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { grantPoints, pointsOf, tierOf, TIERS } from '../loyalty.js';

export const loyaltyRouter = Router();

loyaltyRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const points = await pointsOf(req.user!.id);
    const recent = await query(
      `SELECT delta, reason, ref, created_at FROM loyalty_ledger
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8`,
      [req.user!.id],
    );
    res.json({
      points,
      tier: tierOf(points),
      tiers: TIERS,
      recent: recent.rows.map((r: any) => ({
        delta: Number(r.delta), reason: r.reason, ref: r.ref, at: new Date(r.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CABBA] loyalty me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.get('/top', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.display_name AS name, COALESCE(SUM(l.delta),0)::int AS points
       FROM loyalty_ledger l JOIN users u ON u.id = l.user_id
       GROUP BY u.id, u.display_name
       ORDER BY points DESC LIMIT 10`,
    );
    res.json({ top: result.rows.map((r: any) => ({ name: r.name, points: Number(r.points) })) });
  } catch (error) {
    console.error('[CABBA] loyalty top:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Grant admin : geste commercial, animation de match, compensation. */
loyaltyRouter.post('/grant', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const delta = Number(req.body?.delta);
    const reason = String(req.body?.reason ?? 'geste admin').slice(0, 60);
    if (!email || !Number.isInteger(delta) || delta === 0) {
      res.status(400).json({ error: 'بريد وعدد نقاط صحيح غير صفري مطلوبان.' });
      return;
    }
    const u = await query('SELECT id FROM users WHERE lower(email)=$1', [email]);
    if (!u.rows.length) { res.status(404).json({ error: 'البريد غير مسجل في التطبيق.' }); return; }
    await grantPoints(u.rows[0].id, delta, reason, 'admin');
    res.json({ points: await pointsOf(u.rows[0].id) });
  } catch (error) {
    console.error('[CABBA] loyalty grant admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// سجل التدقيق والتصدير — lecture du journal d'audit + export global
// des données du club (Article 6 du contrat : « export sur simple
// demande » devient un bouton).

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';

export const auditRouter = Router();

auditRouter.get('/', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, actor_name, action, target, detail, created_at
       FROM admin_audit_log ORDER BY created_at DESC LIMIT 500`,
    );
    res.json({
      entries: result.rows.map((r: any) => ({
        id: r.id,
        actor: r.actor_name,
        action: r.action,
        target: r.target,
        detail: r.detail,
        at: new Date(r.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CABBA] audit list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Export global Article 6 : toutes les pièces du club, en un JSON. */
auditRouter.get('/export', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const tables: Array<[string, string]> = [
      ['users', 'SELECT id, email, display_name, role, created_at, terms_accepted_at FROM users ORDER BY created_at'],
      ['matches', 'SELECT * FROM matches ORDER BY match_date DESC'],
      ['tickets', 'SELECT * FROM tickets ORDER BY created_at DESC'],
      ['ticket_scans', 'SELECT * FROM ticket_scans ORDER BY created_at DESC'],
      ['support_donations', 'SELECT * FROM support_donations ORDER BY created_at DESC'],
      ['orders', 'SELECT * FROM orders ORDER BY created_at DESC'],
      ['order_items', 'SELECT * FROM order_items'],
      ['products', 'SELECT * FROM products ORDER BY created_at'],
      ['memberships', 'SELECT * FROM memberships ORDER BY created_at'],
      ['sponsors', 'SELECT * FROM sponsors ORDER BY position'],
      ['admin_audit_log', 'SELECT actor_name, action, target, detail, created_at FROM admin_audit_log ORDER BY created_at DESC'],
    ];
    const data: Record<string, unknown> = {};
    for (const [name, sql] of tables) {
      data[name] = (await query(sql)).rows;
    }
    res.json({ generatedAt: new Date().toISOString(), source: 'CABBA — export Article 6', data });
  } catch (error) {
    console.error('[CABBA] global export:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

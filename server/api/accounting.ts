// المحاسبة والتقارير — agrégats LECTURE SEULE sur les pièces que
// l'application produit déjà : billets (guichet), dons du fonds de
// soutien (registre), boutique (commandes), adhésions. Aucune table
// neuve : la comptabilité lit les pièces, elle ne les duplique pas.
//
// Conventions affichées dans le module :
//  - Billetterie encaissée = billets émis (valid+used) : l'argent pris
//    au guichet ; « consommée » = billets used (entrées au stade).
//  - Boutique = commandes hors pending/cancelled (confirmées et après).
//  - Dons = somme du registre support_donations (jamais saisie à la main).

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';
import { sendMonthlyReport } from '../reporting.js';

export const accountingRouter = Router();

const REVENUE_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];

accountingRouter.get('/summary', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : null;
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : null;
    const P = [from, to];
    const RANGE = `($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
                   AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)`;

    // ---- Billetterie ----
    const t = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('valid','used'))::int AS issued_count,
         COALESCE(SUM(price_dzd) FILTER (WHERE status IN ('valid','used')),0)::int AS issued_total,
         COUNT(*) FILTER (WHERE status='used')::int AS used_count,
         COALESCE(SUM(price_dzd) FILTER (WHERE status='used'),0)::int AS used_total,
         COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled_count
       FROM tickets WHERE ${RANGE}`, P);
    const tm = await query(
      `SELECT t.match_id AS id, m.home_team, m.away_team,
              COUNT(*)::int AS issued_count,
              COALESCE(SUM(t.price_dzd),0)::int AS issued_total,
              COUNT(*) FILTER (WHERE t.status='used')::int AS used_count
       FROM tickets t JOIN matches m ON m.id = t.match_id
       WHERE t.status IN ('valid','used')
         AND ($1::timestamptz IS NULL OR t.created_at >= $1::timestamptz)
         AND ($2::timestamptz IS NULL OR t.created_at < $2::timestamptz)
       GROUP BY t.match_id, m.home_team, m.away_team
       ORDER BY issued_total DESC`, P);
    const tc = await query(
      `SELECT category, COUNT(*)::int AS count, COALESCE(SUM(price_dzd),0)::int AS total
       FROM tickets WHERE status IN ('valid','used') AND ${RANGE}
       GROUP BY category ORDER BY total DESC`, P);

    // ---- Dons du fonds de soutien ----
    const d = await query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_dzd),0)::int AS total
       FROM support_donations WHERE ${RANGE}`, P);
    const dm = await query(
      `SELECT method, COUNT(*)::int AS count, COALESCE(SUM(amount_dzd),0)::int AS total
       FROM support_donations WHERE ${RANGE}
       GROUP BY method ORDER BY total DESC`, P);

    // ---- Boutique ----
    const s = await query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total),0)::int AS total
       FROM orders WHERE ${RANGE}
       GROUP BY status ORDER BY total DESC`, P);
    const storeRows = s.rows.map((r: any) => ({ status: r.status, count: Number(r.count), total: Number(r.total) }));
    const revenueTotal = storeRows.filter((r: any) => REVENUE_STATUSES.includes(r.status)).reduce((a: number, r: any) => a + r.total, 0);
    const revenueCount = storeRows.filter((r: any) => REVENUE_STATUSES.includes(r.status)).reduce((a: number, r: any) => a + r.count, 0);

    // ---- Adhésions ----
    const mem = await query(
      `SELECT COUNT(*) FILTER (WHERE status='active')::int AS active,
              COUNT(*) FILTER (WHERE status='pending')::int AS pending
       FROM memberships WHERE ${RANGE}`, P);
    const memt = await query(
      `SELECT type, COUNT(*)::int AS count FROM memberships
       WHERE status='active' AND ${RANGE} GROUP BY type ORDER BY count DESC`, P);

    // ---- Ventilation mensuelle (6 derniers mois, non filtrée) ----
    const SIX = `created_at >= date_trunc('month', now()) - interval '5 months'`;
    const mt = await query(
      `SELECT to_char(created_at,'YYYY-MM') AS month, COALESCE(SUM(price_dzd),0)::int AS total
       FROM tickets WHERE status IN ('valid','used') AND ${SIX} GROUP BY 1`, []);
    const md = await query(
      `SELECT to_char(created_at,'YYYY-MM') AS month, COALESCE(SUM(amount_dzd),0)::int AS total
       FROM support_donations WHERE ${SIX} GROUP BY 1`, []);
    const ms = await query(
      `SELECT to_char(created_at,'YYYY-MM') AS month, COALESCE(SUM(total),0)::int AS total
       FROM orders WHERE status = ANY($1) AND ${SIX} GROUP BY 1`, [REVENUE_STATUSES]);
    const months = new Map<string, { month: string; tickets: number; donations: number; store: number; total: number }>();
    for (const r of mt.rows) months.set(r.month, { month: r.month, tickets: Number(r.total), donations: 0, store: 0, total: 0 });
    for (const r of md.rows) {
      const e = months.get(r.month) ?? { month: r.month, tickets: 0, donations: 0, store: 0, total: 0 };
      e.donations = Number(r.total); months.set(r.month, e);
    }
    for (const r of ms.rows) {
      const e = months.get(r.month) ?? { month: r.month, tickets: 0, donations: 0, store: 0, total: 0 };
      e.store = Number(r.total); months.set(r.month, e);
    }
    const monthly = [...months.values()]
      .map((e) => ({ ...e, total: e.tickets + e.donations + e.store }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const ticketsTotal = Number(t.rows[0].issued_total);
    const donationsTotal = Number(d.rows[0].total);
    res.json({
      period: { from, to },
      tickets: {
        issuedCount: Number(t.rows[0].issued_count),
        issuedTotal: ticketsTotal,
        usedCount: Number(t.rows[0].used_count),
        usedTotal: Number(t.rows[0].used_total),
        cancelledCount: Number(t.rows[0].cancelled_count),
        byMatch: tm.rows.map((r: any) => ({
          id: r.id, label: `${r.home_team} — ${r.away_team}`,
          issuedCount: Number(r.issued_count), issuedTotal: Number(r.issued_total), usedCount: Number(r.used_count),
        })),
        byCategory: tc.rows.map((r: any) => ({ category: r.category, count: Number(r.count), total: Number(r.total) })),
      },
      donations: {
        count: Number(d.rows[0].count),
        total: donationsTotal,
        byMethod: dm.rows.map((r: any) => ({ method: r.method, count: Number(r.count), total: Number(r.total) })),
      },
      store: { byStatus: storeRows, revenueCount, revenueTotal },
      memberships: {
        active: Number(mem.rows[0].active),
        pending: Number(mem.rows[0].pending),
        byType: memt.rows.map((r: any) => ({ type: r.type, count: Number(r.count) })),
      },
      monthly,
      grandTotal: ticketsTotal + donationsTotal + revenueTotal,
    });
  } catch (error) {
    console.error('[CABBA] accounting summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Envoi manuel du rapport mensuel (admin) : même moteur que l'automatique. */
accountingRouter.post('/report/send', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = req.body?.year ? Number(req.body.year) : target.getFullYear();
    const month = req.body?.month ? Number(req.body.month) : target.getMonth() + 1;
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'شهر غير صالح.' });
      return;
    }
    const result = await sendMonthlyReport(year, month);
    res.json({ sent: true, skipped: (result as { skipped?: string } | null)?.skipped ?? null });
  } catch (error) {
    console.error('[CABBA] report send:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

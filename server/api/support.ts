// صندوق دعم النادي — campagne de soutien administrable.
// Contexte algérien : pas de passerelle de paiement en ligne pour un club ;
// l'encaissement est physique (espèces / CCP / virement) et l'administration
// consigne chaque don. Le montant affiché est TOUJOURS la somme du registre
// (source de vérité unique, aucune saisie manuelle du total).

import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, requireString, optionalString } from './validate.js';

export const supportRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METHODS = ['cash', 'ccp', 'transfer', 'other'] as const;

async function raisedTotal(campaignId: string): Promise<{ raised: number; count: number }> {
  const r = await query(
    `SELECT COALESCE(SUM(amount_dzd), 0)::int AS total, COUNT(*)::int AS count
     FROM support_donations WHERE campaign_id = $1`,
    [campaignId],
  );
  return { raised: Number(r.rows[0].total), count: Number(r.rows[0].count) };
}

const mapCampaign = (row: any, raised: number, count: number) => ({
  id: row.id,
  title: row.title,
  goal: Number(row.goal_dzd),
  raised,
  donationsCount: count,
  bankInfo: row.bank_info,
  active: Boolean(row.active),
  updatedAt: new Date(row.updated_at).toISOString(),
});

/** Campagne active la plus récente — celle affichée sur l'accueil. */
supportRouter.get('/campaign', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM support_campaigns WHERE active = true
       ORDER BY created_at DESC LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) {
      res.json({ campaign: null });
      return;
    }
    const { raised, count } = await raisedTotal(row.id);
    res.json({ campaign: mapCampaign(row, raised, count) });
  } catch (error) {
    console.error('[CABBA] support campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Création : une seule campagne active à la fois (les autres passent en veille). */
supportRouter.post('/campaign', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, goal, bankInfo } = req.body ?? {};
    const cleanTitle = requireString(title, 'title', 200);
    const cleanGoal = goal === undefined || goal === null ? 0 : Number(goal);
    if (!Number.isInteger(cleanGoal) || cleanGoal < 0) {
      res.status(400).json({ error: 'الهدف يجب أن يكون رقماً صحيحاً موجباً.' });
      return;
    }
    const cleanBank = optionalString(bankInfo, 'bankInfo', 2000) ?? '';

    const created = await withTransaction(async (exec) => {
      await exec('UPDATE support_campaigns SET active = false, updated_at = NOW() WHERE active = true');
      const r = await exec(
        `INSERT INTO support_campaigns (title, goal_dzd, bank_info, active, created_by)
         VALUES ($1, $2, $3, true, $4) RETURNING *`,
        [cleanTitle, cleanGoal, cleanBank, req.user!.id],
      );
      return r.rows[0];
    });
    res.status(201).json({ campaign: mapCampaign(created, 0, 0) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] support create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Modification : titre, objectif, coordonnées, actif/inactif. */
supportRouter.patch('/campaign/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const { title, goal, bankInfo, active } = req.body ?? {};
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (title !== undefined) {
      params.push(requireString(title, 'title', 200));
      sets.push(`title = $${params.length}`);
    }
    if (goal !== undefined) {
      const g = Number(goal);
      if (!Number.isInteger(g) || g < 0) {
        res.status(400).json({ error: 'الهدف يجب أن يكون رقماً صحيحاً موجباً.' });
        return;
      }
      params.push(g);
      sets.push(`goal_dzd = $${params.length}`);
    }
    if (bankInfo !== undefined) {
      params.push(optionalString(bankInfo, 'bankInfo', 2000) ?? '');
      sets.push(`bank_info = $${params.length}`);
    }
    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        res.status(400).json({ error: 'active doit être un booléen.' });
        return;
      }
      params.push(active);
      sets.push(`active = $${params.length}`);
    }
    params.push(req.params.id);
    const result = await query(
      `UPDATE support_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!result.rows.length) { res.status(404).json({ error: 'Campagne introuvable.' }); return; }
    const { raised, count } = await raisedTotal(result.rows[0].id);
    res.json({ campaign: mapCampaign(result.rows[0], raised, count) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] support update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Registre des dons (100 plus récents) — consultation admin. */
supportRouter.get('/campaign/:id/donations', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const result = await query(
      `SELECT id, amount_dzd, donor_name, method, note, created_at
       FROM support_donations WHERE campaign_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [req.params.id],
    );
    res.json({
      donations: result.rows.map((row: any) => ({
        id: row.id,
        amount: Number(row.amount_dzd),
        donorName: row.donor_name,
        method: row.method,
        note: row.note,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CABBA] support donations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Consignation d'un don encaissé hors-ligne. */
supportRouter.post('/campaign/:id/donations', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const { amount, donorName, method, note } = req.body ?? {};
    const cleanAmount = Number(amount);
    if (!Number.isInteger(cleanAmount) || cleanAmount <= 0 || cleanAmount > 100_000_000) {
      res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً صحيحاً بين 1 و 100000000 د.ج.' });
      return;
    }
    const cleanMethod = typeof method === 'string' && (METHODS as readonly string[]).includes(method) ? method : 'cash';
    const cleanDonor = optionalString(donorName, 'donorName', 100) ?? 'متبرع مجهول';
    const cleanNote = optionalString(note, 'note', 500) ?? '';

    const inserted = await query(
      `INSERT INTO support_donations (campaign_id, amount_dzd, donor_name, method, note, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [req.params.id, cleanAmount, cleanDonor, cleanMethod, cleanNote, req.user!.id],
    );
    // Don CCP/virement : pièce de paiement en file de validation admin
    if (cleanMethod === 'ccp' || cleanMethod === 'transfer') {
      await query(
        `INSERT INTO payments (kind, ref_id, method, bank_ref, amount, payer_name)
         VALUES ('donation', $1, 'ccp', '', $2, $3)`,
        [inserted.rows[0].id, cleanAmount, cleanDonor],
      ).catch((err) => console.error('[CABBA] payment donation:', err));
    }
    const { raised, count } = await raisedTotal(String(req.params.id));
    res.status(201).json({
      donation: {
        id: inserted.rows[0].id,
        amount: cleanAmount,
        donorName: cleanDonor,
        method: cleanMethod,
        note: cleanNote,
        createdAt: new Date(inserted.rows[0].created_at).toISOString(),
      },
      raised,
      donationsCount: count,
    });
  } catch (error) {
    // 23503 = campagne inexistante
    if ((error as any)?.code === '23503') {
      res.status(404).json({ error: 'Campagne introuvable.' });
      return;
    }
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] support donation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Correction d'erreur de saisie : suppression d'un don consigné. */
supportRouter.delete('/campaign/:id/donations/:donationId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id)) || !UUID_RE.test(String(req.params.donationId))) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const result = await query(
      'DELETE FROM support_donations WHERE id = $1 AND campaign_id = $2',
      [req.params.donationId, req.params.id],
    );
    if (!result.rowCount) { res.status(404).json({ error: 'Don introuvable.' }); return; }
    const { raised, count } = await raisedTotal(String(req.params.id));
    res.json({ raised, donationsCount: count });
  } catch (error) {
    console.error('[CABBA] support donation delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/** ── تصريحات الأنصار للصندوق (file d'attente vérifiée) ─────────────────
 *  Un supporter qui a réellement viré via CCP/BaridiMob le déclare ici ;
 *  l'administration confirme après pointage du compte, et le don est
 *  recopié dans support_donations — le registre reste la source de vérité,
 *  la file n'en est que la déclaration bancaire.
 */
supportRouter.post('/declare', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { amountDzd, reference, donorName } = req.body ?? {};
    const amount = parseInt(String(amountDzd), 10);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100000000) {
      res.status(400).json({ error: 'Montant invalide.' });
      return;
    }
    const camp = await query(
      `SELECT id FROM support_campaigns WHERE active = true ORDER BY created_at DESC LIMIT 1`,
    );
    if (!camp.rowCount) { res.status(404).json({ error: 'Aucune campagne active.' }); return; }
    const name = String(donorName ?? '').trim().slice(0, 200) || 'متبرع مجهول';
    const ref = String(reference ?? '').trim().slice(0, 120);
    const inserted = await query(
      `INSERT INTO donation_declarations (campaign_id, user_id, donor_name, amount_dzd, method, reference)
       VALUES ($1, $2, $3, $4, 'ccp', $5) RETURNING id`,
      [camp.rows[0].id, req.user!.id, name, amount, ref],
    );
    res.status(201).json({ id: inserted.rows[0].id });
  } catch (error) {
    console.error('[CABBA] support declare:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** File des déclarations : pending d'abord, puis historique récent. */
supportRouter.get('/declarations', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT d.id, d.donor_name AS "donorName", d.amount_dzd AS "amountDzd", d.reference, d.status,
              d.created_at AS "createdAt", u.display_name AS "userName"
       FROM donation_declarations d
       LEFT JOIN users u ON u.id = d.user_id
       ORDER BY (d.status = 'pending') DESC, d.created_at DESC
       LIMIT 100`,
    );
    res.json({ declarations: result.rows });
  } catch (error) {
    console.error('[CABBA] support declarations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Confirmation : le don bascule dans le registre dans la même transaction. */
supportRouter.post('/declarations/:id/confirm', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    let campaignId = '';
    let handled = false;
    await withTransaction(async (client) => {
      const sel = await client.query(
        `SELECT * FROM donation_declarations WHERE id = $1 FOR UPDATE`, [req.params.id],
      );
      if (!sel.rowCount) { res.status(404).json({ error: 'Déclaration introuvable.' }); handled = true; return; }
      const dec = sel.rows[0];
      if (dec.status !== 'pending') { res.status(409).json({ error: 'Déclaration déjà traitée.' }); handled = true; return; }
      await client.query(`UPDATE donation_declarations SET status = 'confirmed' WHERE id = $1`, [dec.id]);
      await client.query(
        `INSERT INTO support_donations (campaign_id, amount_dzd, donor_name, method, note, recorded_by)
         VALUES ($1, $2, $3, 'ccp', $4, $5)`,
        [dec.campaign_id, dec.amount_dzd, dec.donor_name,
         `تصريح أنصار — مرجع ${dec.reference || '—'}`, req.user!.id],
      );
      campaignId = String(dec.campaign_id);
    });
    if (handled) return;
    const { raised, count } = await raisedTotal(campaignId);
    res.json({ raised, donationsCount: count });
  } catch (error) {
    console.error('[CABBA] support declaration confirm:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Rejet : la déclaration sort de la file sans toucher au registre. */
supportRouter.post('/declarations/:id/reject', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const result = await query(
      `UPDATE donation_declarations SET status = 'rejected'
       WHERE id = $1 AND status = 'pending'`, [req.params.id],
    );
    if (!result.rowCount) { res.status(404).json({ error: 'Déclaration introuvable ou déjà traitée.' }); return; }
    res.json({ ok: true });
  } catch (error) {
    console.error('[CABBA] support declaration reject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// شركاء النادي — sponsors : lecture publique des partenaires actifs,
// écriture réservée à l'admin. Les logos sont des URL (le club héberge
// où il veut) : aucune dépendance R2 pour ce module.

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, optionalString, requireString } from './validate.js';
import { logAdmin } from '../auditLog.js';

export const sponsorsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mapSponsor = (row: any) => ({
  id: row.id,
  name: row.name,
  url: row.url,
  logoUrl: row.logo_url,
  position: Number(row.position),
  active: row.active,
});

/** Vitrine publique : partenaires actifs, dans l'ordre choisi. */
sponsorsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM sponsors WHERE active = TRUE ORDER BY position, created_at LIMIT 24`,
    );
    res.json({ sponsors: result.rows.map(mapSponsor) });
  } catch (error) {
    console.error('[CABBA] sponsors list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gestion complète (admin) : liste totale, création, édition, retrait. */
sponsorsRouter.get('/admin', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM sponsors ORDER BY position, created_at');
    res.json({ sponsors: result.rows.map(mapSponsor) });
  } catch (error) {
    console.error('[CABBA] sponsors admin list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

sponsorsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const name = requireString(req.body?.name, 'name', 120);
    const logoUrl = requireString(req.body?.logoUrl, 'logoUrl', 500);
    const url = optionalString(req.body?.url, 'url', 500) ?? '';
    const position = Number.isInteger(Number(req.body?.position)) ? Number(req.body.position) : 100;
    const result = await query(
      `INSERT INTO sponsors (name, url, logo_url, position, active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, url, logoUrl, position, req.body?.active !== false],
    );
    void logAdmin(req.user, 'sponsor.create', name);
    res.status(201).json({ sponsor: mapSponsor(result.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] sponsor create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

sponsorsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const existing = await query('SELECT * FROM sponsors WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) { res.status(404).json({ error: 'الشريك غير موجود.' }); return; }
    const row = existing.rows[0];
    const name = optionalString(req.body?.name, 'name', 120) ?? row.name;
    const logoUrl = optionalString(req.body?.logoUrl, 'logoUrl', 500) ?? row.logo_url;
    const url = optionalString(req.body?.url, 'url', 500) ?? row.url;
    const position = req.body?.position === undefined ? Number(row.position) : Number(req.body.position);
    const active = req.body?.active === undefined ? row.active : Boolean(req.body.active);
    const updated = await query(
      `UPDATE sponsors SET name=$2, url=$3, logo_url=$4, position=$5, active=$6
       WHERE id=$1 RETURNING *`,
      [req.params.id, name, url, logoUrl, position, active],
    );
    void logAdmin(req.user, 'sponsor.update', String(req.params.id), name);
    res.json({ sponsor: mapSponsor(updated.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] sponsor update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

sponsorsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const result = await query('DELETE FROM sponsors WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'الشريك غير موجود.' }); return; }
    void logAdmin(req.user, 'sponsor.delete', String(req.params.id));
    res.json({ deleted: true });
  } catch (error) {
    console.error('[CABBA] sponsor delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

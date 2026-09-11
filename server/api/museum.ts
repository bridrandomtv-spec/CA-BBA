// المتحف — mémoire officielle du club : frise publique, CRUD admin.

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';
import { isValidationError, optionalString, requireString } from './validate.js';

export const museumRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = ['title', 'legend', 'event'] as const;

const mapEntry = (row: any) => ({
  id: row.id,
  year: Number(row.year),
  kind: row.kind,
  title: row.title,
  body: row.body,
  imageUrl: row.image_url,
  position: Number(row.position),
});

/** Frise publique : toute la mémoire du club, sans connexion. */
museumRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM museum_entries ORDER BY year DESC, position LIMIT 200`,
    );
    res.json({ entries: result.rows.map(mapEntry) });
  } catch (error) {
    console.error('[CABBA] museum list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

museumRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const year = Number(req.body?.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      res.status(400).json({ error: 'سنة غير صالحة.' });
      return;
    }
    const title = requireString(req.body?.title, 'title', 200);
    const kind = typeof req.body?.kind === 'string' && (KINDS as readonly string[]).includes(req.body.kind) ? req.body.kind : 'event';
    const body = optionalString(req.body?.body, 'body', 4000) ?? '';
    const imageUrl = optionalString(req.body?.imageUrl, 'imageUrl', 500) ?? '';
    const position = Number.isInteger(Number(req.body?.position)) ? Number(req.body.position) : 100;
    const result = await query(
      `INSERT INTO museum_entries (year, kind, title, body, image_url, position)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [year, kind, title, body, imageUrl, position],
    );
    res.status(201).json({ entry: mapEntry(result.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] museum create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

museumRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const existing = await query('SELECT * FROM museum_entries WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) { res.status(404).json({ error: 'الإدخال غير موجود.' }); return; }
    const row = existing.rows[0];
    const year = req.body?.year === undefined ? Number(row.year) : Number(req.body.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) { res.status(400).json({ error: 'سنة غير صالحة.' }); return; }
    const title = optionalString(req.body?.title, 'title', 200) ?? row.title;
    const kind = typeof req.body?.kind === 'string' && (KINDS as readonly string[]).includes(req.body.kind) ? req.body.kind : row.kind;
    const body = optionalString(req.body?.body, 'body', 4000) ?? row.body;
    const imageUrl = optionalString(req.body?.imageUrl, 'imageUrl', 500) ?? row.image_url;
    const position = req.body?.position === undefined ? Number(row.position) : Number(req.body.position);
    const updated = await query(
      `UPDATE museum_entries SET year=$2, kind=$3, title=$4, body=$5, image_url=$6, position=$7
       WHERE id=$1 RETURNING *`,
      [req.params.id, year, kind, title, body, imageUrl, position],
    );
    res.json({ entry: mapEntry(updated.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] museum update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

museumRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const result = await query('DELETE FROM museum_entries WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'الإدخال غير موجود.' }); return; }
    res.json({ deleted: true });
  } catch (error) {
    console.error('[CABBA] museum delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

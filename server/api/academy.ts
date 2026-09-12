// مدرسة الكرة — inscriptions publiques des jeunes, gestion admin.

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';
import { isValidationError, optionalString, requireString } from './validate.js';

export const academyRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = ['U7', 'U9', 'U11', 'U13', 'U15', 'U17'] as const;
const STATUSES = ['pending', 'accepted', 'waitlist', 'rejected'] as const;

const mapReg = (row: any) => ({
  id: row.id,
  childName: row.child_name,
  birthYear: Number(row.birth_year),
  category: row.category,
  parentName: row.parent_name,
  parentPhone: row.parent_phone,
  parentEmail: row.parent_email,
  notes: row.notes,
  status: row.status,
  at: new Date(row.created_at).toISOString(),
});

/** Inscription publique : un parent inscrit son enfant en 30 secondes. */
academyRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const childName = requireString(req.body?.childName, 'childName', 120);
    const parentName = requireString(req.body?.parentName, 'parentName', 120);
    const parentPhone = requireString(req.body?.parentPhone, 'parentPhone', 30);
    const birthYear = Number(req.body?.birthYear);
    if (!Number.isInteger(birthYear) || birthYear < 2005 || birthYear > 2025) {
      res.status(400).json({ error: 'سنة ميلاد غير صالحة.' });
      return;
    }
    const category = typeof req.body?.category === 'string' && (CATEGORIES as readonly string[]).includes(req.body.category)
      ? req.body.category : null;
    if (!category) { res.status(400).json({ error: 'فئة غير صالحة.' }); return; }
    const parentEmail = optionalString(req.body?.parentEmail, 'parentEmail', 254) ?? '';
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      res.status(400).json({ error: 'بريد إلكتروني غير صالح.' });
      return;
    }
    const notes = optionalString(req.body?.notes, 'notes', 1000) ?? '';
    const result = await query(
      `INSERT INTO academy_registrations
         (child_name, birth_year, category, parent_name, parent_phone, parent_email, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [childName, birthYear, category, parentName, parentPhone, parentEmail, notes],
    );
    res.status(201).json({ registration: mapReg(result.rows[0]) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] academy register:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

academyRouter.get('/admin', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM academy_registrations ORDER BY created_at DESC LIMIT 300');
    res.json({ registrations: result.rows.map(mapReg) });
  } catch (error) {
    console.error('[CABBA] academy list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

academyRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const status = typeof req.body?.status === 'string' && (STATUSES as readonly string[]).includes(req.body.status)
      ? req.body.status : null;
    if (!status) { res.status(400).json({ error: 'حالة غير صالحة.' }); return; }
    const result = await query(
      'UPDATE academy_registrations SET status=$2 WHERE id=$1 RETURNING *',
      [req.params.id, status],
    );
    if (!result.rows.length) { res.status(404).json({ error: 'التسجيل غير موجود.' }); return; }
    res.json({ registration: mapReg(result.rows[0]) });
  } catch (error) {
    console.error('[CABBA] academy status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

academyRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const result = await query('DELETE FROM academy_registrations WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'التسجيل غير موجود.' }); return; }
    res.json({ deleted: true });
  } catch (error) {
    console.error('[CABBA] academy delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

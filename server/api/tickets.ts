// مراقبة التذاكر الإلكترونية — émission, scan aux portes, journal.
// Un seul téléphone par agent : caméra (BarcodeDetector) ou saisie du
// code, vérification serveur en une requête, son OK / son rejet.
// Anti-fraude : code aléatoire 12 caractères (32 symboles, ~60 bits),
// usage unique (UPDATE conditionnel status='valid'), journal de chaque
// passage même rejeté, compteurs par porte.

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, optionalString, requireString } from './validate.js';

export const ticketsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1
const CATEGORIES = ['virage', 'tribune', 'vip'] as const;

/** Admin OU scanner (agent de porte) : ni plus, ni moins. */
function staffOk(req: Request, res: Response): boolean {
  if (req.user!.role === 'admin' || req.user!.role === 'scanner') return true;
  res.status(403).json({ error: 'صلاحية مراقبة التذاكر مطلوبة.' });
  return false;
}

function newCode(): string {
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

const mapTicket = (row: any) => ({
  id: row.id,
  matchId: row.match_id,
  code: row.code,
  holderName: row.holder_name,
  category: row.category,
  price: Number(row.price_dzd),
  status: row.status,
  usedAt: row.used_at ? new Date(row.used_at).toISOString() : null,
  usedGate: row.used_gate,
  matchLabel: row.home_team ? `${row.home_team} — ${row.away_team}` : undefined,
});

/** Émission d'un ticket (admin) : bureau du club ou vente guichet. */
ticketsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchId, holderName, category, price } = req.body ?? {};
    if (typeof matchId !== 'string' || !UUID_RE.test(matchId)) {
      res.status(400).json({ error: 'matchId invalide.' });
      return;
    }
    const match = await query('SELECT id, home_team, away_team FROM matches WHERE id=$1', [matchId]);
    if (!match.rows.length) {
      res.status(404).json({ error: 'المباراة غير موجودة.' });
      return;
    }
    const cleanHolder = optionalString(holderName, 'holderName', 100) ?? '';
    const cleanCategory = typeof category === 'string' && (CATEGORIES as readonly string[]).includes(category) ? category : 'virage';
    const cleanPrice = price === undefined || price === null ? 0 : Number(price);
    if (!Number.isInteger(cleanPrice) || cleanPrice < 0) {
      res.status(400).json({ error: 'السعر يجب أن يكون رقماً صحيحاً موجباً.' });
      return;
    }

    // Code unique : 3 tentatives suffisent (espace 32^12)
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode();
      const inserted = await query(
        `INSERT INTO tickets (match_id, code, holder_name, category, price_dzd, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO NOTHING
         RETURNING *`,
        [matchId, code, cleanHolder, cleanCategory, cleanPrice, req.user!.id],
      );
      if (inserted.rows.length) {
        res.status(201).json({ ticket: mapTicket(inserted.rows[0]) });
        return;
      }
    }
    res.status(500).json({ error: 'تعذر توليد رمز التذكرة.' });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] ticket issue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Liste des tickets d'un match (admin ou scanner). */
ticketsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!staffOk(req, res)) return;
  try {
    const matchId = String(req.query.matchId ?? '');
    if (!UUID_RE.test(matchId)) {
      res.status(400).json({ error: 'matchId invalide.' });
      return;
    }
    const result = await query(
      `SELECT t.*, m.home_team, m.away_team FROM tickets t
       JOIN matches m ON m.id = t.match_id
       WHERE t.match_id = $1
       ORDER BY t.created_at DESC LIMIT 500`,
      [matchId],
    );
    res.json({ tickets: result.rows.map(mapTicket) });
  } catch (error) {
    console.error('[CABBA] tickets list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * LE scan de porte : une requête, une réponse, un son.
 * result = 'ok' | 'used' | 'invalid' | 'cancelled' — le client joue
 * le son et la couleur correspondants. Journal systématique.
 */
ticketsRouter.post('/scan', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!staffOk(req, res)) return;
  try {
    const { code, gate } = req.body ?? {};
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const cleanGate = optionalString(gate, 'gate', 40) ?? '';
    if (!cleanCode) {
      res.status(400).json({ error: 'رمز التذكرة مطلوب.' });
      return;
    }

    const found = await query(
      `SELECT t.*, m.home_team, m.away_team FROM tickets t
       JOIN matches m ON m.id = t.match_id
       WHERE t.code = $1`,
      [cleanCode],
    );
    const row = found.rows[0];

    if (!row) {
      await query(
        `INSERT INTO ticket_scans (ticket_id, raw_code, result, gate, scanner_id)
         VALUES (NULL, $1, 'invalid', $2, $3)`,
        [cleanCode, cleanGate, req.user!.id],
      );
      res.json({ result: 'invalid', reason: 'تذكرة غير موجودة.' });
      return;
    }
    if (row.status === 'used') {
      await query(
        `INSERT INTO ticket_scans (ticket_id, raw_code, result, gate, scanner_id)
         VALUES ($1, $2, 'used', $3, $4)`,
        [row.id, cleanCode, cleanGate, req.user!.id],
      );
      res.json({
        result: 'used',
        reason: 'التذكرة مستعملة بالفعل.',
        ticket: mapTicket(row),
      });
      return;
    }
    if (row.status === 'cancelled') {
      await query(
        `INSERT INTO ticket_scans (ticket_id, raw_code, result, gate, scanner_id)
         VALUES ($1, $2, 'cancelled', $3, $4)`,
        [row.id, cleanCode, cleanGate, req.user!.id],
      );
      res.json({ result: 'cancelled', reason: 'التذكرة ملغاة.', ticket: mapTicket(row) });
      return;
    }

    // Usage unique : le UPDATE conditionnel est le verrou anti-double-entrée
    const updated = await query(
      `UPDATE tickets SET status='used', used_at=NOW(), used_gate=$2, used_by=$3
       WHERE id=$1 AND status='valid' RETURNING *`,
      [row.id, cleanGate, req.user!.id],
    );
    if (!updated.rows.length) {
      res.json({ result: 'used', reason: 'التذكرة مستعملة بالفعل.', ticket: mapTicket(row) });
      return;
    }
    await query(
      `INSERT INTO ticket_scans (ticket_id, raw_code, result, gate, scanner_id)
       VALUES ($1, $2, 'ok', $3, $4)`,
      [row.id, cleanCode, cleanGate, req.user!.id],
    );
    const entries = await query(
      `SELECT COUNT(*)::int AS n FROM tickets WHERE match_id=$1 AND status='used'`,
      [row.match_id],
    );
    res.json({ result: 'ok', ticket: mapTicket(updated.rows[0]), entries: Number(entries.rows[0].n) });
  } catch (error) {
    console.error('[CABBA] ticket scan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Compteurs par porte + totaux (admin ou scanner). */
ticketsRouter.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!staffOk(req, res)) return;
  try {
    const matchId = String(req.query.matchId ?? '');
    if (!UUID_RE.test(matchId)) {
      res.status(400).json({ error: 'matchId invalide.' });
      return;
    }
    const totals = await query(
      `SELECT COUNT(*)::int AS issued,
              COUNT(*) FILTER (WHERE status='valid')::int AS valid,
              COUNT(*) FILTER (WHERE status='used')::int AS used,
              COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
       FROM tickets WHERE match_id=$1`,
      [matchId],
    );
    const gates = await query(
      `SELECT COALESCE(NULLIF(used_gate,''), 'بدون بوابة') AS gate, COUNT(*)::int AS n
       FROM tickets WHERE match_id=$1 AND status='used'
       GROUP BY 1 ORDER BY 2 DESC`,
      [matchId],
    );
    res.json({ totals: totals.rows[0], byGate: gates.rows });
  } catch (error) {
    console.error('[CABBA] tickets stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Annulation d'un ticket encore valide (admin seul). */
ticketsRouter.post('/:id/cancel', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }
    const result = await query(
      `UPDATE tickets SET status='cancelled' WHERE id=$1 AND status='valid' RETURNING *`,
      [req.params.id],
    );
    if (!result.rows.length) {
      res.status(404).json({ error: 'التذكرة غير موجودة أو ليست صالحة.' });
      return;
    }
    res.json({ ticket: mapTicket(result.rows[0]) });
  } catch (error) {
    console.error('[CABBA] ticket cancel:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

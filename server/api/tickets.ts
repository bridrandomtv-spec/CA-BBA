// Billetterie électronique — contrôle des entrées au stade par mobile.
// Émission admin (jeton aléatoire 192 bits dans le QR), vérification au scan
// avec passage atomique valid→used (UPDATE conditionnel : deux scanneurs
// simultanés sur le même QR = un seul OK), journal complet des tentatives
// (y compris codes inconnus) avec porte, agent et horodatage.

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { optionalString, isValidationError } from './validate.js';

export const ticketsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const canScan = (req: Request) => req.user!.role === 'admin' || req.user!.role === 'scanner';

/** POST / — émission d'un ticket (admin). code = jeton opaque du QR. */
ticketsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchId, holderName, category, price, ownerId } = req.body ?? {};
    if (typeof matchId !== 'string' || !UUID_RE.test(matchId)) {
      res.status(400).json({ error: 'Match invalide.' });
      return;
    }
    const cleanHolder = optionalString(holderName, 'holderName', 100) ?? '';
    const cleanCategory = optionalString(category, 'category', 50) ?? 'tribune';
    const cleanPrice = price === undefined || price === null ? 0 : Number(price);
    if (!Number.isInteger(cleanPrice) || cleanPrice < 0) {
      res.status(400).json({ error: 'Prix invalide.' });
      return;
    }
    const cleanOwner = typeof ownerId === 'string' && UUID_RE.test(ownerId) ? ownerId : null;

    const code = crypto.randomBytes(24).toString('base64url');
    const inserted = await query(
      `INSERT INTO match_tickets (match_id, code, holder_name, category, price_dzd, owner_id, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, code, status, holder_name, category, price_dzd, created_at`,
      [matchId, code, cleanHolder, cleanCategory, cleanPrice, cleanOwner, req.user!.id],
    );
    const row = inserted.rows[0];
    res.status(201).json({
      ticket: {
        id: row.id, code: row.code, status: row.status, holder: row.holder_name,
        category: row.category, price: Number(row.price_dzd),
        createdAt: new Date(row.created_at).toISOString(),
      },
    });
  } catch (error) {
    if ((error as any)?.code === '23503') { res.status(400).json({ error: 'Référence invalide (match ou propriétaire).' }); return; }
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] ticket issue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /mine — les tickets du supporter connecté (QR dans l'app). */
ticketsRouter.get('/mine', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT t.id, t.code, t.status, t.category, t.holder_name,
              m.home_team, m.away_team, m.stadium, m.match_date
       FROM match_tickets t JOIN matches m ON m.id = t.match_id
       WHERE t.owner_id = $1
       ORDER BY m.match_date DESC LIMIT 50`,
      [req.user!.id],
    );
    res.json({
      tickets: result.rows.map((row: any) => ({
        id: row.id, code: row.code, status: row.status, category: row.category,
        homeTeam: row.home_team, awayTeam: row.away_team,
        stadium: row.stadium, matchDate: String(row.match_date),
      })),
    });
  } catch (error) {
    console.error('[CABBA] my tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /scan — vérification au portique (admin ou scanner). */
ticketsRouter.post('/scan', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canScan(req)) { res.status(403).json({ error: 'Droit de scan requis.' }); return; }
    const { code, gate, matchId } = req.body ?? {};
    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'Code manquant.' });
      return;
    }
    const cleanCode = code.trim();
    const cleanGate = optionalString(gate, 'gate', 50) ?? '';

    const found = await query('SELECT * FROM match_tickets WHERE code=$1', [cleanCode]);
    const row = found.rows[0];

    let result: string;
    if (!row) result = 'invalid';
    else if (row.status === 'cancelled') result = 'cancelled';
    else if (typeof matchId === 'string' && matchId && row.match_id !== matchId) result = 'wrong_match';
    else if (row.status === 'used') result = 'already_used';
    else {
      // Atomique : deux scanneurs simultanés → un seul 'ok'.
      const upd = await query(
        `UPDATE match_tickets SET status='used' WHERE id=$1 AND status='valid' RETURNING id`,
        [row.id],
      );
      result = upd.rowCount ? 'ok' : 'already_used';
    }

    await query(
      `INSERT INTO ticket_scans (ticket_id, code, gate, scanner_id, result)
       VALUES ($1,$2,$3,$4,$5)`,
      [row ? row.id : null, cleanCode, cleanGate, req.user!.id, result],
    );

    let entries: number | null = null;
    let firstUse: string | null = null;
    const matchForCount = row ? row.match_id : (typeof matchId === 'string' && UUID_RE.test(matchId) ? matchId : null);
    if (matchForCount) {
      const c = await query(
        `SELECT COUNT(*)::int AS n FROM match_tickets WHERE match_id=$1 AND status='used'`,
        [matchForCount],
      );
      entries = Number(c.rows[0].n);
    }
    if (row && result === 'already_used') {
      const f = await query(
        `SELECT scanned_at FROM ticket_scans WHERE ticket_id=$1 AND result='ok'
         ORDER BY scanned_at ASC LIMIT 1`,
        [row.id],
      );
      if (f.rows.length) firstUse = new Date(f.rows[0].scanned_at).toISOString();
    }

    res.json({
      result,
      entries,
      firstUse,
      ticket: row ? { holder: row.holder_name, category: row.category } : null,
    });
  } catch (error) {
    console.error('[CABBA] ticket scan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /match/:matchId — gestion admin : tickets, compteurs, journal. */
ticketsRouter.get('/match/:matchId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const [tickets, stats, scans] = await Promise.all([
      query(
        `SELECT id, code, holder_name, category, price_dzd, status, owner_id, created_at
         FROM match_tickets WHERE match_id=$1 ORDER BY created_at DESC LIMIT 300`,
        [req.params.id],
      ),
      query(
        `SELECT COUNT(*)::int AS issued,
                COUNT(*) FILTER (WHERE status='used')::int AS used,
                COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
         FROM match_tickets WHERE match_id=$1`,
        [req.params.id],
      ),
      query(
        `SELECT s.result, s.gate, s.scanned_at, u.display_name AS scanner
         FROM ticket_scans s JOIN match_tickets t ON t.id = s.ticket_id
         LEFT JOIN users u ON u.id = s.scanner_id
         WHERE t.match_id=$1 ORDER BY s.scanned_at DESC LIMIT 50`,
        [req.params.id],
      ),
    ]);
    res.json({
      tickets: tickets.rows.map((row: any) => ({
        id: row.id, code: row.code, holder: row.holder_name, category: row.category,
        price: Number(row.price_dzd), status: row.status, hasOwner: Boolean(row.owner_id),
        createdAt: new Date(row.created_at).toISOString(),
      })),
      stats: {
        issued: Number(stats.rows[0].issued),
        used: Number(stats.rows[0].used),
        cancelled: Number(stats.rows[0].cancelled),
      },
      scans: scans.rows.map((row: any) => ({
        result: row.result, gate: row.gate, scanner: row.scanner,
        at: new Date(row.scanned_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CABBA] tickets match:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PATCH /:id — annulation d'un ticket (admin, avant usage). */
ticketsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const { status } = req.body ?? {};
    if (status !== 'cancelled') { res.status(400).json({ error: 'Seule l\'annulation est autorisée.' }); return; }
    const upd = await query(
      `UPDATE match_tickets SET status='cancelled' WHERE id=$1 AND status='valid'`,
      [req.params.id],
    );
    if (!upd.rowCount) { res.status(409).json({ error: 'Ticket déjà utilisé ou déjà annulé.' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error('[CABBA] ticket cancel:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

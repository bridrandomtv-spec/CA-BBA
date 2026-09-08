// Backend des sondages (migration 016).
// Contrat hérité de gallery/predictions : requireAuth partout (l'app est
// derrière login), écritures admin via requireAdmin, validation partagée,
// agrégats en SQL — le client ne calcule jamais un résultat qu'il pourrait
// forger.

import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, requireString } from './validate.js';

export const pollsRouter = Router();

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
/** Fenêtre d'affichage des sondages fermés avant disparition du fil. */
const CLOSED_VISIBILITY_DAYS = 30;

interface OptionRow {
  poll_id: string;
  id: string;
  label: string;
  position: number;
  votes: number;
  my_vote: boolean | null;
}

pollsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const pollsResult = await query(
      `SELECT id, question, status, created_at
       FROM polls
       WHERE status = 'open' OR closed_at > NOW() - ($1::int * INTERVAL '1 day')
       ORDER BY (status = 'open') DESC, created_at DESC
       LIMIT 20`,
      [CLOSED_VISIBILITY_DAYS],
    );
    if (!pollsResult.rows.length) {
      res.json({ polls: [] });
      return;
    }

    const pollIds = pollsResult.rows.map((row) => row.id);
    const optionsResult = await query<OptionRow>(
      `SELECT o.poll_id, o.id, o.label, o.position,
              COUNT(v.user_id)::int AS votes,
              BOOL_OR(v.user_id = $2) AS my_vote
       FROM poll_options o
       LEFT JOIN poll_votes v ON v.option_id = o.id
       WHERE o.poll_id = ANY($1::uuid[])
       GROUP BY o.poll_id, o.id, o.label, o.position
       ORDER BY o.position ASC`,
      [pollIds, req.user!.id],
    );

    const optionsByPoll = new Map<string, Array<{ id: string; label: string; votes: number; isMyVote: boolean }>>();
    for (const option of optionsResult.rows) {
      const list = optionsByPoll.get(option.poll_id) ?? [];
      list.push({ id: option.id, label: option.label, votes: Number(option.votes), isMyVote: Boolean(option.my_vote) });
      optionsByPoll.set(option.poll_id, list);
    }

    res.json({
      polls: pollsResult.rows.map((row) => ({
        id: row.id,
        question: row.question,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        options: optionsByPoll.get(row.id) ?? [],
      })),
    });
  } catch (error) {
    console.error('[CABBA] polls list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

pollsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, options } = req.body ?? {};
    const cleanQuestion = requireString(question, 'question', 500);

    if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      res.status(400).json({ error: `بين ${MIN_OPTIONS} و${MAX_OPTIONS} خيارات مطلوبة.` });
      return;
    }
    const cleanOptions: string[] = [];
    for (const raw of options) {
      const label = requireString(raw, 'option', 200);
      // UNIQUE(poll_id, label) trancherait en 23505/500 : le doublon est
      // refusé ici avec un 400 lisible.
      if (cleanOptions.some((existing) => existing === label)) {
        res.status(400).json({ error: 'الخيارات المكررة غير مسموحة.' });
        return;
      }
      cleanOptions.push(label);
    }

    // Sondage + options dans UNE transaction : jamais de sondage sans
    // options (état inaffichable) si la seconde insertion échoue.
    const created = await withTransaction(async (exec) => {
      const poll = await exec(
        `INSERT INTO polls (question, created_by) VALUES ($1, $2)
         RETURNING id, question, status, created_at`,
        [cleanQuestion, req.user!.id],
      );
      const pollRow = poll.rows[0];
      for (let index = 0; index < cleanOptions.length; index += 1) {
        await exec(
          'INSERT INTO poll_options (poll_id, label, position) VALUES ($1, $2, $3)',
          [pollRow.id, cleanOptions[index], index],
        );
      }
      return pollRow;
    });

    res.status(201).json({
      poll: {
        id: created.id,
        question: created.question,
        status: created.status,
        createdAt: new Date(created.created_at).toISOString(),
        options: cleanOptions.map((label, position) => ({ id: null, label, position, votes: 0, isMyVote: false })),
      },
    });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] poll create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

pollsRouter.post('/:id/vote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { optionId } = req.body ?? {};
    if (typeof optionId !== 'string' || !optionId) {
      res.status(400).json({ error: 'optionId requis.' });
      return;
    }

    const pollResult = await query('SELECT status FROM polls WHERE id=$1', [req.params.id]);
    if (!pollResult.rowCount) { res.status(404).json({ error: 'Poll not found' }); return; }
    if (pollResult.rows[0].status !== 'open') {
      res.status(409).json({ error: 'الاستطلاع مغلق.' });
      return;
    }

    // Anti-forge : l'option doit APPARTENIR au sondage voté.
    const optionResult = await query(
      'SELECT id FROM poll_options WHERE id=$1 AND poll_id=$2',
      [optionId, req.params.id],
    );
    if (!optionResult.rowCount) {
      res.status(404).json({ error: 'الخيار غير موجود في هذا الاستطلاع.' });
      return;
    }

    // Upsert : vote modifiable tant que le sondage est ouvert.
    await query(
      `INSERT INTO poll_votes (poll_id, user_id, option_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_id) DO UPDATE
         SET option_id = EXCLUDED.option_id, created_at = NOW()`,
      [req.params.id, req.user!.id, optionId],
    );

    const counts = await query(
      `SELECT o.id, COUNT(v.user_id)::int AS votes
       FROM poll_options o
       LEFT JOIN poll_votes v ON v.option_id = o.id
       WHERE o.poll_id = $1
       GROUP BY o.id, o.position
       ORDER BY o.position ASC`,
      [req.params.id],
    );
    res.json({
      optionId,
      options: counts.rows.map((row) => ({ id: row.id, votes: Number(row.votes) })),
    });
  } catch (error) {
    console.error('[CABBA] poll vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

pollsRouter.patch('/:id/close', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await query('SELECT id, status FROM polls WHERE id=$1', [req.params.id]);
    if (!existing.rowCount) { res.status(404).json({ error: 'Poll not found' }); return; }
    if (existing.rows[0].status === 'closed') {
      res.status(409).json({ error: 'الاستطلاع مغلق بالفعل.' });
      return;
    }
    await query(`UPDATE polls SET status='closed', closed_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[CABBA] poll close:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

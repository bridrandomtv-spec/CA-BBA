// Jeu de pronostics réel (migration 014).
//
// Règles :
//  - un pronostic par compte et par match (UNIQUE), modifiable TANT QUE le
//    match est 'scheduled' — après le coup d'envoi, la porte est fermée ;
//  - 50 points par score EXACT, calculés à la lecture sur les matchs
//    'finished' : aucun crochet dans le scheduler football ;
//  - les comptes anonymisés (deleted_at) sont exclus du classement.

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';

export const predictionsRouter = Router();

const POINTS_PER_EXACT_SCORE = 50;

const predictRateLimit = createRateLimiter({
  windowMs: 60 * 60_000,
  limit: 30,
  message: 'توقعات كثيرة في وقت قصير.',
  keyPrefix: 'prediction',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

/** Agrégat commun au classement et à la fiche personnelle. */
const SCORED_SELECT = `
  SELECT u.id AS user_id, u.display_name,
         COUNT(*)::int AS predictions,
         COUNT(*) FILTER (WHERE p.predicted_home = m.home_score AND p.predicted_away = m.away_score)::int AS correct,
         COALESCE(SUM($2) FILTER (WHERE p.predicted_home = m.home_score AND p.predicted_away = m.away_score), 0)::int AS points
  FROM match_predictions p
  JOIN matches m ON m.id = p.match_id AND m.status = 'finished'
  JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
  GROUP BY u.id, u.display_name`;

predictionsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const upcomingResult = await query(
      `SELECT m.id, m.home_team, m.away_team, m.competition,
              TO_CHAR(m.match_date, 'YYYY-MM-DD') AS date,
              TO_CHAR(m.match_time, 'HH24:MI') AS time,
              p.predicted_home, p.predicted_away
       FROM matches m
       LEFT JOIN match_predictions p ON p.match_id = m.id AND p.user_id = $1
       WHERE m.status = 'scheduled'
       ORDER BY m.match_date ASC, m.match_time ASC
       LIMIT 5`,
      [userId],
    );

    // Liste complète (sans LIMIT) : le rang de l'utilisateur se calcule sur
    // l'ensemble des pronostiqueurs, l'affichage ne garde que le top 10.
    const scoredResult = await query(SCORED_SELECT, [userId, POINTS_PER_EXACT_SCORE]);
    const scored = scoredResult.rows
      .map((row) => ({
        userId: row.user_id,
        displayName: row.display_name || 'مشجع',
        predictions: Number(row.predictions),
        correct: Number(row.correct),
        points: Number(row.points),
      }))
      .sort((a, b) => b.points - a.points || b.correct - a.correct || a.displayName.localeCompare(b.displayName));

    const myIndex = scored.findIndex((row) => row.userId === userId);
    const me = myIndex >= 0
      ? { rank: myIndex + 1, points: scored[myIndex].points, correct: scored[myIndex].correct, predictions: scored[myIndex].predictions }
      : { rank: null, points: 0, correct: 0, predictions: 0 };

    res.json({
      pointsPerExactScore: POINTS_PER_EXACT_SCORE,
      upcoming: upcomingResult.rows.map((row) => ({
        id: row.id,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        competition: row.competition,
        date: row.date,
        time: row.time,
        myHome: row.predicted_home ?? null,
        myAway: row.predicted_away ?? null,
      })),
      leaderboard: scored.slice(0, 10).map(({ userId: _id, ...rest }) => rest),
      me,
    });
  } catch (error) {
    console.error('[CABBA] predictions overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

predictionsRouter.post('/:id', requireAuth, predictRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { homeScore, awayScore } = req.body ?? {};
    // Bornes alignées sur les CHECK de la migration : 400 lisible au lieu
    // d'une violation de contrainte en 500.
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)
      || homeScore < 0 || homeScore > 30 || awayScore < 0 || awayScore > 30) {
      res.status(400).json({ error: 'النتيجة المتوقعة يجب أن تكون رقمين بين 0 و30.' });
      return;
    }

    const matchResult = await query('SELECT id, status FROM matches WHERE id=$1', [req.params.id]);
    if (!matchResult.rows.length) { res.status(404).json({ error: 'Match not found' }); return; }
    if (matchResult.rows[0].status !== 'scheduled') {
      // live/finished/postponed : la fenêtre de pronostic est fermée.
      res.status(409).json({ error: 'انتهت فترة التوقع لهذه المباراة.' });
      return;
    }

    // Upsert : DO UPDATE conditionnel rend le rejeu du même pronostic no-op.
    await query(
      `INSERT INTO match_predictions (user_id, match_id, predicted_home, predicted_away)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, match_id) DO UPDATE
         SET predicted_home = EXCLUDED.predicted_home,
             predicted_away = EXCLUDED.predicted_away,
             updated_at = NOW()
         WHERE match_predictions.predicted_home <> EXCLUDED.predicted_home
            OR match_predictions.predicted_away <> EXCLUDED.predicted_away`,
      [req.user!.id, req.params.id, homeScore, awayScore],
    );

    res.status(201).json({ success: true, homeScore, awayScore });
  } catch (error) {
    console.error('[CABBA] prediction upsert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

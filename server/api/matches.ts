import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { footballEvents } from '../football/events.js';

export const matchesRouter = Router();

matchesRouter.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM matches ORDER BY created_at DESC');
    res.json(result.rows.map(row => ({
      id: row.id,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      competition: row.competition,
      date: row.match_date,
      time: row.match_time,
      stadium: row.stadium,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      createdAt: row.created_at,
      elapsedMinute: row.elapsed_minute ?? null,
      extraMinute: row.extra_minute ?? null,
      apiStatus: row.api_status ?? null,
      apiFixtureId: row.api_fixture_id ?? null,
    })));
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

matchesRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { homeTeam, awayTeam, competition, date, time, stadium, status, homeScore, awayScore } = req.body;
    const result = await query(
      `INSERT INTO matches (home_team, away_team, competition, match_date, match_time, stadium, status, home_score, away_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [homeTeam, awayTeam, competition, date, time, stadium, status, homeScore, awayScore]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Error adding match:', error);
    res.status(500).json({ error: 'Failed to add match' });
  }
});

matchesRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { homeTeam, awayTeam, competition, date, time, stadium, status, homeScore, awayScore } = req.body;
    await query(
      `UPDATE matches
       SET home_team = $1, away_team = $2, competition = $3, match_date = $4, match_time = $5, stadium = $6, status = $7, home_score = $8, away_score = $9
       WHERE id = $10`,
      [homeTeam, awayTeam, competition, date, time, stadium, status, homeScore, awayScore, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

matchesRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM matches WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

// Updates / Commentaries
matchesRouter.get('/:id/updates', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM match_updates WHERE match_id = $1 ORDER BY created_at DESC', [id]);
    res.json(result.rows.map(row => ({
      id: row.id,
      minute: row.minute,
      text: row.text,
      type: row.type,
      team: row.team,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Error fetching match updates:', error);
    res.status(500).json({ error: 'Failed to fetch match updates' });
  }
});

matchesRouter.post('/:id/updates', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { minute, text, type, team } = req.body;
    const result = await query(
      `INSERT INTO match_updates (match_id, minute, text, type, team)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, minute, text, type, team]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Error adding match update:', error);
    res.status(500).json({ error: 'Failed to add match update' });
  }
});

// Highlights
matchesRouter.get('/highlights/all', async (req, res) => {
  try {
    const result = await query('SELECT * FROM match_highlights ORDER BY created_at DESC');
    res.json(result.rows.map(row => ({
      id: row.id,
      title: row.title,
      match: row.match_title,
      date: row.highlight_date,
      duration: row.duration,
      thumbnail: row.thumbnail,
      videoUrl: row.video_url,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Error fetching highlights:', error);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

matchesRouter.post('/highlights', requireAdmin, async (req, res) => {
  try {
    const { title, match, date, duration, thumbnail, videoUrl } = req.body;
    const result = await query(
      `INSERT INTO match_highlights (title, match_title, highlight_date, duration, thumbnail, video_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, match, date, duration, thumbnail, videoUrl]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Error adding highlight:', error);
    res.status(500).json({ error: 'Failed to add highlight' });
  }
});

// API-Football synchronized data: the browser reads PostgreSQL only.
matchesRouter.get('/:id/events', async (req, res) => {
  try {
    const result = await query(`SELECT id, minute, extra_minute, type, detail, comments, team_api_id, player_api_id, player_name, assist_player_api_id, assist_player_name, created_at FROM match_events WHERE match_id=$1 ORDER BY minute NULLS LAST, extra_minute NULLS LAST, created_at`, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('[CABBA] match events:', error);
    res.status(500).json({ error: 'Failed to fetch match events' });
  }
});

matchesRouter.get('/:id/lineups', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM match_lineups WHERE match_id=$1 ORDER BY team_api_id, starter DESC, number NULLS LAST`, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('[CABBA] match lineups:', error);
    res.status(500).json({ error: 'Failed to fetch match lineups' });
  }
});

matchesRouter.get('/:id/statistics', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM match_statistics WHERE match_id=$1 ORDER BY team_api_id`, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('[CABBA] match statistics:', error);
    res.status(500).json({ error: 'Failed to fetch match statistics' });
  }
});


// One DB-backed snapshot for the Match Center detail view.
// The browser uses this endpoint only; API-Football remains server-side.
matchesRouter.get('/:id/center', async (req, res) => {
  try {
    const matchResult = await query(
      `SELECT id, home_team, away_team, competition, match_date, match_time, stadium, status, home_score, away_score, api_status, elapsed_minute, extra_minute, api_fixture_id, home_team_api_id, away_team_api_id, home_logo_url, away_logo_url, api_last_synced_at
       FROM matches WHERE id=$1 LIMIT 1`, [req.params.id],
    );
    if (!matchResult.rowCount) return res.status(404).json({ error: 'Match not found' });
    const [events, lineups, statistics] = await Promise.all([
      query(`SELECT id, api_event_id, minute, extra_minute, type, detail, comments, team_api_id, player_api_id, player_name, assist_player_api_id, assist_player_name, raw_json, created_at FROM match_events WHERE match_id=$1 ORDER BY minute NULLS LAST, extra_minute NULLS LAST, created_at`, [req.params.id]),
      query(`SELECT id, team_api_id, player_api_id, player_name, number, position, grid, starter, raw_json, updated_at FROM match_lineups WHERE match_id=$1 ORDER BY team_api_id, starter DESC, number NULLS LAST`, [req.params.id]),
      query(`SELECT id, team_api_id, statistics, raw_json, updated_at FROM match_statistics WHERE match_id=$1 ORDER BY team_api_id`, [req.params.id]),
    ]);
    const m = matchResult.rows[0];
    res.json({
      match: {
        id: m.id, homeTeam: m.home_team, awayTeam: m.away_team, competition: m.competition,
        date: m.match_date, time: m.match_time, stadium: m.stadium, status: m.status,
        homeScore: m.home_score, awayScore: m.away_score, apiStatus: m.api_status,
        elapsedMinute: m.elapsed_minute, extraMinute: m.extra_minute, apiFixtureId: m.api_fixture_id,
        homeTeamApiId: m.home_team_api_id, awayTeamApiId: m.away_team_api_id,
        homeLogoUrl: m.home_logo_url, awayLogoUrl: m.away_logo_url, apiLastSyncedAt: m.api_last_synced_at,
      },
      events: events.rows, lineups: lineups.rows, statistics: statistics.rows,
    });
  } catch (error) {
    console.error('[CABBA] match center:', error);
    res.status(500).json({ error: 'Failed to fetch match center' });
  }
});

// Server-Sent Events: one PostgreSQL-backed stream per connected supporter.
matchesRouter.get('/:id/stream', async (req, res) => {
  const matchId = req.params.id;
  try {
    const exists = await query('SELECT id FROM matches WHERE id=$1 LIMIT 1', [matchId]);
    if (!exists.rowCount) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = async (reason = 'initial') => {
      const match = await query(`SELECT id, home_team, away_team, status, home_score, away_score, api_status, elapsed_minute, extra_minute, api_last_synced_at FROM matches WHERE id=$1`, [matchId]);
      if (match.rowCount) res.write(`event: match\ndata: ${JSON.stringify({ match: match.rows[0], reason })}\n\n`);
    };
    const listener = (event: { matchId:string; reason?:string }) => {
      if (event.matchId === matchId) void send(event.reason ?? 'fixture').catch(() => undefined);
    };
    footballEvents.on('match:changed', listener);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
    await send('initial');
    req.on('close', () => {
      clearInterval(heartbeat);
      footballEvents.off('match:changed', listener);
      res.end();
    });
  } catch (error) {
    console.error('[CABBA] SSE match stream:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to open match stream' });
  }
});


// ============================ MVP (« رجل المباراة ») ============================
// Le vote MVP vivait dans un useState local avec une liste vide : rien
// n'était agrégé. Candidats = titulaires réels (match_lineups), votes
// persistés (migration 015), un vote modifiable par compte et par match.

matchesRouter.get('/:id/mvp', requireAuth, async (req: Request, res: Response) => {
  try {
    const matchResult = await query(
      `SELECT id, home_team, away_team, status, home_team_api_id, away_team_api_id
       FROM matches WHERE id=$1 LIMIT 1`,
      [req.params.id],
    );
    if (!matchResult.rowCount) { res.status(404).json({ error: 'Match not found' }); return; }
    const m = matchResult.rows[0];

    const candidates = await query(
      `SELECT l.player_api_id, l.player_name, l.number, l.position, l.team_api_id,
              COUNT(v.id)::int AS votes,
              BOOL_OR(v.user_id = $2) AS my_vote
       FROM match_lineups l
       LEFT JOIN match_mvp_votes v
              ON v.match_id = l.match_id AND v.player_api_id = l.player_api_id
       WHERE l.match_id = $1 AND l.starter = TRUE AND l.player_api_id IS NOT NULL
       GROUP BY l.player_api_id, l.player_name, l.number, l.position, l.team_api_id
       ORDER BY votes DESC, l.player_name ASC`,
      [req.params.id, req.user!.id],
    );

    res.json({
      match: {
        id: m.id,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        status: m.status,
        homeTeamApiId: m.home_team_api_id,
        awayTeamApiId: m.away_team_api_id,
      },
      candidates: candidates.rows.map((row) => ({
        playerApiId: row.player_api_id,
        playerName: row.player_name,
        number: row.number,
        position: row.position,
        teamApiId: row.team_api_id,
        votes: Number(row.votes),
        isMyVote: Boolean(row.my_vote),
      })),
    });
  } catch (error) {
    console.error('[CABBA] mvp candidates:', error);
    res.status(500).json({ error: 'Failed to fetch MVP candidates' });
  }
});

matchesRouter.post('/:id/mvp/vote', requireAuth, async (req: Request, res: Response) => {
  try {
    const playerApiId = Number((req.body ?? {}).playerApiId);
    if (!Number.isInteger(playerApiId) || playerApiId <= 0) {
      res.status(400).json({ error: 'playerApiId invalide.' });
      return;
    }

    const matchResult = await query('SELECT status FROM matches WHERE id=$1 LIMIT 1', [req.params.id]);
    if (!matchResult.rowCount) { res.status(404).json({ error: 'Match not found' }); return; }
    if (!['live', 'finished'].includes(matchResult.rows[0].status)) {
      res.status(409).json({ error: 'التصويت متاح أثناء المباراة وبعدها فقط.' });
      return;
    }

    // Anti-forge : le joueur doit EXISTER dans les compositions du match.
    const playerResult = await query(
      `SELECT player_name FROM match_lineups
       WHERE match_id=$1 AND player_api_id=$2 AND starter = TRUE
       LIMIT 1`,
      [req.params.id, playerApiId],
    );
    if (!playerResult.rowCount) {
      res.status(404).json({ error: 'اللاعب غير موجود ضمن التشكيلة الأساسية.' });
      return;
    }

    await query(
      `INSERT INTO match_mvp_votes (match_id, user_id, player_api_id, player_name)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (match_id, user_id) DO UPDATE
         SET player_api_id = EXCLUDED.player_api_id,
             player_name = EXCLUDED.player_name,
             created_at = NOW()`,
      [req.params.id, req.user!.id, playerApiId, playerResult.rows[0].player_name],
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('[CABBA] mvp vote:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

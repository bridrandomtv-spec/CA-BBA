import { Router } from 'express';
import { requireAdmin } from '../auth.js';
import { query } from '../db/index.js';
import { env } from '../env.js';
import { footballApi, footballQuotaStatus } from '../football/client.js';
import { getCompetitionCoverage, clearCompetitionAccessBlock } from '../football/coverage.js';
import { syncCompetitionFixtures, syncStandings } from '../football/sync.js';

export const footballRouter = Router();

footballRouter.get('/standings', async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM league_standings WHERE league_api_id=$1 AND season=$2 ORDER BY rank`, [env.apiFootballLeagueId ?? 0, env.apiFootballSeason ?? 0]);
    res.json(result.rows);
  } catch (error) {
    console.error('[CABBA] standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

footballRouter.get('/coverage', requireAdmin, async (req, res) => {
  try {
    const force = String(req.query.refresh ?? '') === '1' || String(req.query.refresh ?? '').toLowerCase() === 'true';
    if (force) await clearCompetitionAccessBlock();
    const coverage = await getCompetitionCoverage({ force });
    res.json({ coverage, quota: footballQuotaStatus() });
  } catch (error) {
    console.error('[CABBA] football coverage:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to fetch football coverage', quota: footballQuotaStatus() });
  }
});

footballRouter.get('/status', requireAdmin, async (_req, res) => {
  const last = await query(`SELECT operation, fixture_id, success, error_message, created_at FROM football_sync_log ORDER BY created_at DESC LIMIT 20`);
  res.json({ configured: Boolean(env.apiFootballKey), leagueId: env.apiFootballLeagueId ?? null, teamId: env.apiFootballTeamId ?? null, season: env.apiFootballSeason ?? null, quota: footballQuotaStatus(), recent: last.rows });
});

footballRouter.get('/lookup', requireAdmin, async (req, res) => {
  if (!env.apiFootballKey) return res.status(503).json({ error: 'API_FOOTBALL_KEY is not configured' });
  const league = String(req.query.league ?? 'Ligue 2');
  const team = String(req.query.team ?? 'Bordj');
  try {
    const leagueSearch:any = await footballApi('/leagues', { search: league });
    const leagues = { ...leagueSearch, response: (leagueSearch.response ?? []).filter((x:any) => String(x.country?.name ?? '').toLowerCase() === 'algeria') };
    const teams:any = await footballApi('/teams', { search: team });
    res.json({ leagues: leagues.response ?? [], teams: teams.response ?? [], quota: footballQuotaStatus() });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'API-Football lookup failed' });
  }
});

footballRouter.post('/sync', requireAdmin, async (_req, res) => {
  if (!env.apiFootballKey) return res.status(503).json({ error: 'API_FOOTBALL_KEY is not configured' });
  try {
    const fixtures = await syncCompetitionFixtures();
    const standings = footballQuotaStatus().remaining > 0 ? await syncStandings() : { synced: false, count: 0 };
    res.json({ fixtures, standings, quota: footballQuotaStatus() });
  } catch (error) {
    console.error('[CABBA] manual football sync:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Football sync failed', quota: footballQuotaStatus() });
  }
});


// ====================== Agrégats CABBA (perspective serveur) ======================
// Le client ne connaît pas apiFootballTeamId : la perspective « nos buts /
// notre classement » est calculée ici, dans la lignée de « le navigateur ne
// lit que PostgreSQL via Express ».

footballRouter.get('/team-summary', async (_req, res) => {
  try {
    const teamId = env.apiFootballTeamId;

    // API-Football non configurée : réponse explicite plutôt que 500 — les
    // écrans retomberont sur leurs états vides existants.
    if (!teamId) {
      res.json({ configured: false, standings: null, matches: [] });
      return;
    }

    const standingsResult = await query(
      `SELECT rank, points, played, win, draw, lose, goals_for, goals_against, goals_diff, form
       FROM league_standings
       WHERE league_api_id = $1 AND season = $2 AND team_api_id = $3
       LIMIT 1`,
      [env.apiFootballLeagueId ?? 0, env.apiFootballSeason ?? 0, teamId],
    );

    // 30 dernières rencontres TERMINÉES impliquant CABBA. Les matchs créés à
    // la main (api ids NULL) sont exclus : sans identifiant fournisseur,
    // aucune perspective fiable n'est possible.
    const matchesResult = await query(
      `SELECT id, home_team, away_team,
              TO_CHAR(match_date, 'YYYY-MM-DD') AS date,
              home_score, away_score, home_team_api_id, away_team_api_id
       FROM matches
       WHERE status = 'finished'
         AND (home_team_api_id = $1 OR away_team_api_id = $1)
       ORDER BY match_date DESC, created_at DESC
       LIMIT 30`,
      [teamId],
    );

    const matches = matchesResult.rows.map((row) => {
      const isHome = row.home_team_api_id === teamId;
      const goalsFor = (isHome ? row.home_score : row.away_score) ?? 0;
      const goalsAgainst = (isHome ? row.away_score : row.home_score) ?? 0;
      return {
        id: row.id,
        date: row.date,
        opponent: isHome ? row.away_team : row.home_team,
        venue: isHome ? 'home' : 'away',
        goalsFor,
        goalsAgainst,
        result: goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D',
      };
    });

    const standing = standingsResult.rows[0] ?? null;
    res.json({
      configured: true,
      standings: standing
        ? {
            rank: standing.rank,
            points: standing.points ?? 0,
            played: standing.played ?? 0,
            win: standing.win ?? 0,
            draw: standing.draw ?? 0,
            lose: standing.lose ?? 0,
            goalsFor: standing.goals_for ?? 0,
            goalsAgainst: standing.goals_against ?? 0,
            goalsDiff: standing.goals_diff ?? 0,
            form: standing.form ?? null,
          }
        : null,
      matches,
    });
  } catch (error) {
    console.error('[CABBA] team summary:', error);
    res.status(500).json({ error: 'Failed to fetch team summary' });
  }
});

// Distribution des buts CABBA par tranche de 15 minutes, agrégée en SQL.
// Règles API-Football encodées dans le WHERE :
//  - `type = 'Goal'` couvre AUSSI les pénaltys manqués (`detail =
//    'Missed Penalty'`) : exclus, ce ne sont pas des buts ;
//  - un but CABBA = événement de CABBA SAUF own goal, PLUS les own goals
//    adverses ; `IS DISTINCT FROM` gère les team_api_id NULL.
footballRouter.get('/goals-by-minute', async (_req, res) => {
  try {
    const teamId = env.apiFootballTeamId;
    if (!teamId) {
      res.json({ configured: false, goals: [] });
      return;
    }

    const result = await query(
      `SELECT
         CASE
           WHEN e.minute IS NULL THEN '90+'
           WHEN e.minute <= 15 THEN '0-15'
           WHEN e.minute <= 30 THEN '16-30'
           WHEN e.minute <= 45 THEN '31-45'
           WHEN e.minute <= 60 THEN '46-60'
           WHEN e.minute <= 75 THEN '61-75'
           WHEN e.minute <= 90 THEN '76-90'
           ELSE '90+'
         END AS bucket,
         COUNT(*)::int AS goals
       FROM match_events e
       JOIN matches m ON m.id = e.match_id
       WHERE e.type = 'Goal'
         AND COALESCE(e.detail, '') <> 'Missed Penalty'
         AND m.status = 'finished'
         AND m.api_league_id = $1
         AND m.api_season = $2
         AND (
              (e.team_api_id = $3 AND COALESCE(e.detail, '') <> 'Own Goal')
           OR (e.team_api_id IS DISTINCT FROM $3 AND COALESCE(e.detail, '') = 'Own Goal')
         )
       GROUP BY bucket`,
      [env.apiFootballLeagueId ?? 0, env.apiFootballSeason ?? 0, teamId],
    );

    res.json({ configured: true, goals: result.rows });
  } catch (error) {
    console.error('[CABBA] goals by minute:', error);
    res.status(500).json({ error: 'Failed to fetch goals distribution' });
  }
});

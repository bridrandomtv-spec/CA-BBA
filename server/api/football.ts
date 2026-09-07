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

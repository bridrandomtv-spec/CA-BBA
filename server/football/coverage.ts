import { query } from '../db/index.js';
import { env } from '../env.js';
import { FootballApiError, footballApi } from './client.js';

type Coverage = {
  fixtures: boolean;
  standings: boolean;
  players: boolean;
  topScorers: boolean;
  events: boolean;
  lineups: boolean;
  statisticsFixtures: boolean;
  statisticsPlayers: boolean;
};

type CoverageRow = Coverage & {
  leagueApiId: number;
  season: number;
  seasonListed: boolean;
  apiAccessBlocked: boolean;
  lastError: string | null;
  checkedAt: string;
};

const REFRESH_MS = 24 * 60 * 60_000;

function toCoverageRow(row: any): CoverageRow {
  return {
    leagueApiId: Number(row.league_api_id),
    season: Number(row.season),
    fixtures: Boolean(row.fixtures),
    standings: Boolean(row.standings),
    players: Boolean(row.players),
    topScorers: Boolean(row.top_scorers),
    events: Boolean(row.events),
    lineups: Boolean(row.lineups),
    statisticsFixtures: Boolean(row.statistics_fixtures),
    statisticsPlayers: Boolean(row.statistics_players),
    seasonListed: Boolean(row.season_listed),
    apiAccessBlocked: Boolean(row.api_access_blocked),
    lastError: row.last_error ?? null,
    checkedAt: new Date(row.checked_at).toISOString(),
  };
}

export function coverageAllows(coverage: CoverageRow | null, feature: keyof Coverage) {
  if (!coverage || coverage.apiAccessBlocked) return false;
  return Boolean(coverage[feature]);
}

export async function getCompetitionCoverage(options: { force?: boolean } = {}): Promise<CoverageRow | null> {
  if (!env.apiFootballLeagueId || !env.apiFootballSeason || !env.apiFootballKey) return null;

  const existing = await query(
    `SELECT * FROM football_competition_coverage WHERE league_api_id=$1 AND season=$2 LIMIT 1`,
    [env.apiFootballLeagueId, env.apiFootballSeason],
  );
  const row = existing.rows[0];
  if (!options.force && row && Date.now() - new Date(row.checked_at).getTime() < REFRESH_MS) {
    return toCoverageRow(row);
  }

  try {
    const data: any = await footballApi('/leagues', { id: env.apiFootballLeagueId });
    const league = (data.response ?? [])[0];
    const season = (league?.seasons ?? []).find((item: any) => Number(item.year) === env.apiFootballSeason);
    const c = season?.coverage ?? {};
    const values = {
      league_api_id: env.apiFootballLeagueId,
      season: env.apiFootballSeason,
      fixtures: Boolean(c.fixtures),
      standings: Boolean(c.standings),
      players: Boolean(c.players),
      top_scorers: Boolean(c.top_scorers),
      events: Boolean(c.fixtures?.events),
      lineups: Boolean(c.fixtures?.lineups),
      statistics_fixtures: Boolean(c.fixtures?.statistics_fixtures),
      statistics_players: Boolean(c.players_statistics),
      season_listed: Boolean(season),
      api_access_blocked: false,
      last_error: null,
    };
    const saved = await query(
      `INSERT INTO football_competition_coverage
        (league_api_id, season, fixtures, standings, players, top_scorers, events, lineups,
         statistics_fixtures, statistics_players, season_listed, api_access_blocked, last_error, checked_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
       ON CONFLICT (league_api_id, season) DO UPDATE SET
         fixtures=EXCLUDED.fixtures, standings=EXCLUDED.standings, players=EXCLUDED.players,
         top_scorers=EXCLUDED.top_scorers, events=EXCLUDED.events, lineups=EXCLUDED.lineups,
         statistics_fixtures=EXCLUDED.statistics_fixtures, statistics_players=EXCLUDED.statistics_players,
         season_listed=EXCLUDED.season_listed, api_access_blocked=EXCLUDED.api_access_blocked,
         last_error=EXCLUDED.last_error, checked_at=NOW(), updated_at=NOW()
       RETURNING *`,
      [values.league_api_id, values.season, values.fixtures, values.standings, values.players,
        values.top_scorers, values.events, values.lineups, values.statistics_fixtures,
        values.statistics_players, values.season_listed, values.api_access_blocked, values.last_error],
    );
    return toCoverageRow(saved.rows[0]);
  } catch (error) {
    if (isPlanAccessError(error)) {
      const saved = await query(
        `INSERT INTO football_competition_coverage
          (league_api_id, season, season_listed, api_access_blocked, last_error, checked_at, updated_at)
         VALUES ($1,$2,TRUE,TRUE,$3,NOW(),NOW())
         ON CONFLICT (league_api_id, season) DO UPDATE SET
           api_access_blocked=TRUE, last_error=EXCLUDED.last_error, checked_at=NOW(), updated_at=NOW()
         RETURNING *`,
        [env.apiFootballLeagueId, env.apiFootballSeason, error instanceof Error ? error.message : String(error)],
      );
      return toCoverageRow(saved.rows[0]);
    }
    throw error;
  }
}

export async function markCompetitionAccessBlocked(error: unknown) {
  if (!env.apiFootballLeagueId || !env.apiFootballSeason || !isPlanAccessError(error)) return;
  const message = error instanceof Error ? error.message : String(error);
  await query(
    `INSERT INTO football_competition_coverage
      (league_api_id, season, season_listed, api_access_blocked, last_error, checked_at, updated_at)
     VALUES ($1,$2,TRUE,TRUE,$3,NOW(),NOW())
     ON CONFLICT (league_api_id, season) DO UPDATE SET
       api_access_blocked=TRUE, last_error=EXCLUDED.last_error, checked_at=NOW(), updated_at=NOW()`,
    [env.apiFootballLeagueId, env.apiFootballSeason, message],
  );
}

export async function clearCompetitionAccessBlock() {
  if (!env.apiFootballLeagueId || !env.apiFootballSeason) return;
  await query(
    `UPDATE football_competition_coverage
     SET api_access_blocked=FALSE, last_error=NULL, updated_at=NOW()
     WHERE league_api_id=$1 AND season=$2`,
    [env.apiFootballLeagueId, env.apiFootballSeason],
  );
}

export function isPlanAccessError(error: unknown) {
  const message = error instanceof FootballApiError || error instanceof Error ? error.message : String(error);
  return /free plans do not have access|plan.*do not have access|try from \d{4} to \d{4}/i.test(message);
}
